import 'server-only';
import { Prisma, PaymentStatus } from '@prisma/client';
import { logEvent } from '@/lib/logging';
import {
  callFlutterwaveVerifyTransaction,
  type FlutterwaveVerifyApiResponse,
} from '../flutterwave';

export interface VerifyPaymentOptions {
  prismaClient?: any;
  verifyCaller?: typeof callFlutterwaveVerifyTransaction;
  now?: Date;
}

export interface VerifyPaymentResult {
  success: boolean;
  paymentId?: string;
  internalReference?: string;
  alreadyProcessed?: boolean;
  status?: PaymentStatus;
  error?: string;
  code?: string;
}

/**
 * Actively verifies a Flutterwave transaction and conditionally transitions
 * payment status from PENDING to SUCCESSFUL or FAILED.
 * Enforces RULES_PAYMENTS Rules 3, 6, 9, and 11.
 */
export async function verifyPaymentTransaction(
  transactionId: string | number,
  expectedReference?: string,
  options?: VerifyPaymentOptions
): Promise<VerifyPaymentResult> {
  const cleanTransactionId = String(transactionId).trim();
  if (!cleanTransactionId) {
    return {
      success: false,
      error: 'Transaction ID is required for verification.',
      code: 'INVALID_TRANSACTION_ID',
    };
  }

  const prisma = options?.prismaClient ?? (await import('@/lib/db')).prisma;

  // 1. Call Flutterwave active verify endpoint (RULES_PAYMENTS Rule 6)
  const verifyCaller = options?.verifyCaller ?? callFlutterwaveVerifyTransaction;
  const fwRes: FlutterwaveVerifyApiResponse = await verifyCaller(cleanTransactionId);

  if (fwRes.status !== 'success' || !fwRes.data) {
    return {
      success: false,
      error: fwRes.message || 'Failed to verify transaction with Flutterwave.',
      code: 'GATEWAY_VERIFICATION_FAILED',
    };
  }

  const txData = fwRes.data;
  const internalReference = expectedReference || txData.tx_ref;

  if (!internalReference) {
    return {
      success: false,
      error: 'Transaction reference is missing from gateway verification response.',
      code: 'MISSING_TX_REF',
    };
  }

  // 2. Fetch the existing Payment record
  const payment = await prisma.payment.findUnique({
    where: { internalReference },
    select: {
      id: true,
      amount: true,
      internalReference: true,
      status: true,
      studentId: true,
      parentId: true,
    },
  });

  if (!payment) {
    logEvent({
      level: 'warn',
      event: 'payment_verify_unknown_reference',
      actorType: 'system',
      outcome: 'failure',
      details: {
        internalReference,
      },
    });
    return {
      success: false,
      error: 'Payment record not found for this reference.',
      code: 'PAYMENT_NOT_FOUND',
    };
  }

  // 3. Idempotency gate: If already SUCCESSFUL, return immediately (RULES_PAYMENTS Rule 8)
  if (payment.status === PaymentStatus.SUCCESSFUL) {
    return {
      success: true,
      paymentId: payment.id,
      internalReference: payment.internalReference,
      status: payment.status,
      alreadyProcessed: true,
    };
  }

  // 4. Closed state machine check: terminal states cannot transition (RULES_PAYMENTS Rule 3)
  if (payment.status === PaymentStatus.FAILED || payment.status === PaymentStatus.REFUNDED) {
    return {
      success: false,
      paymentId: payment.id,
      internalReference: payment.internalReference,
      status: payment.status,
      error: `Payment is already marked as ${payment.status}.`,
      code: 'PAYMENT_TERMINAL_STATE',
    };
  }

  // 5. Invariant Checks (RULES_PAYMENTS Rule 11)

  // Invariant A: Gateway transaction status
  if (txData.status !== 'successful') {
    await prisma.payment.updateMany({
      where: { id: payment.id, status: PaymentStatus.PENDING },
      data: { status: PaymentStatus.FAILED },
    });

    logEvent({
      level: 'warn',
      event: 'payment_verification_gateway_failed',
      actorType: 'system',
      entityType: 'payment',
      entityId: payment.id,
      outcome: 'failure',
      details: {
        internalReference: payment.internalReference,
        gatewayStatus: txData.status,
      },
    });

    return {
      success: false,
      paymentId: payment.id,
      internalReference: payment.internalReference,
      status: PaymentStatus.FAILED,
      error: `Payment status from gateway was '${txData.status}'.`,
      code: 'TRANSACTION_NOT_SUCCESSFUL',
    };
  }

  // Invariant B: Currency check (RULES_PAYMENTS Rule 1: NGN only)
  if (txData.currency !== 'NGN') {
    await prisma.payment.updateMany({
      where: { id: payment.id, status: PaymentStatus.PENDING },
      data: { status: PaymentStatus.FAILED },
    });

    logEvent({
      level: 'error',
      event: 'payment_currency_mismatch',
      actorType: 'system',
      entityType: 'payment',
      entityId: payment.id,
      outcome: 'failure',
      details: {
        internalReference: payment.internalReference,
        gatewayCurrency: txData.currency,
      },
    });

    return {
      success: false,
      paymentId: payment.id,
      internalReference: payment.internalReference,
      status: PaymentStatus.FAILED,
      error: 'Currency mismatch: only NGN transactions are accepted.',
      code: 'CURRENCY_MISMATCH',
    };
  }

  // Invariant C: Amount check (no underpayment allowed)
  const paidDecimal = new Prisma.Decimal(txData.amount);
  if (paidDecimal.lessThan(payment.amount)) {
    await prisma.payment.updateMany({
      where: { id: payment.id, status: PaymentStatus.PENDING },
      data: { status: PaymentStatus.FAILED },
    });

    logEvent({
      level: 'error',
      event: 'payment_amount_mismatch',
      actorType: 'system',
      entityType: 'payment',
      entityId: payment.id,
      outcome: 'failure',
      details: {
        internalReference: payment.internalReference,
        reason: 'underpayment',
      },
    });

    return {
      success: false,
      paymentId: payment.id,
      internalReference: payment.internalReference,
      status: PaymentStatus.FAILED,
      error: 'Payment amount mismatch: paid amount is less than expected amount.',
      code: 'AMOUNT_MISMATCH',
    };
  }

  // Invariant D: tx_ref matching
  if (txData.tx_ref !== payment.internalReference) {
    await prisma.payment.updateMany({
      where: { id: payment.id, status: PaymentStatus.PENDING },
      data: { status: PaymentStatus.FAILED },
    });

    logEvent({
      level: 'error',
      event: 'payment_reference_mismatch',
      actorType: 'system',
      entityType: 'payment',
      entityId: payment.id,
      outcome: 'failure',
      details: {
        internalReference: payment.internalReference,
      },
    });

    return {
      success: false,
      paymentId: payment.id,
      internalReference: payment.internalReference,
      status: PaymentStatus.FAILED,
      error: 'Payment reference mismatch between gateway and internal record.',
      code: 'REFERENCE_MISMATCH',
    };
  }

  // 6. Atomic conditional update (Pending -> Successful)
  const verifiedAt = options?.now ?? new Date();
  const updateResult = await prisma.payment.updateMany({
    where: {
      id: payment.id,
      status: PaymentStatus.PENDING,
    },
    data: {
      status: PaymentStatus.SUCCESSFUL,
      flutterwaveReference: String(txData.id),
      verifiedAt,
    },
  });

  // If update count is 0, another concurrent process already finalized it
  if (updateResult.count > 0) {
    logEvent({
      level: 'info',
      event: 'payment_verified_successful',
      actorType: 'system',
      entityType: 'payment',
      entityId: payment.id,
      outcome: 'success',
      details: {
        internalReference: payment.internalReference,
        flutterwaveId: String(txData.id),
      },
    });
  }

  return {
    success: true,
    paymentId: payment.id,
    internalReference: payment.internalReference,
    status: PaymentStatus.SUCCESSFUL,
    alreadyProcessed: updateResult.count === 0,
  };
}

