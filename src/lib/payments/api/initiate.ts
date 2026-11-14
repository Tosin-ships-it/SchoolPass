import 'server-only';
import { Prisma, PaymentStatus } from '@prisma/client';
import { getSession, type AuthSession } from '@/lib/auth';
import { checkParentStudentAuthorization } from '@/lib/auth';
import { logEvent } from '@/lib/logging';
import {
  callFlutterwaveInitiatePayment,
  generateInternalPaymentReference,
  MIN_ONLINE_PAYMENT_AMOUNT_NGN,
} from '../flutterwave';
import { validatePaymentAmount } from '../ledger';

export interface InitiateOnlinePaymentInput {
  studentId: string;
  amount: number | string | Prisma.Decimal;
  redirectUrl?: string;
}

export interface InitiateOnlinePaymentResult {
  success: boolean;
  paymentId?: string;
  internalReference?: string;
  checkoutUrl?: string;
  error?: string;
  code?: string;
}

export interface InitiatePaymentOptions {
  session?: AuthSession | null;
  prismaClient?: any;
  initiateCaller?: typeof callFlutterwaveInitiatePayment;
  checkAuthorization?: typeof checkParentStudentAuthorization;
  validateAmount?: typeof validatePaymentAmount;
  now?: Date;
}

const IDEMPOTENCY_WINDOW_MS = 15 * 60 * 1000; // 15 minutes (RULES_PAYMENTS Rule 5)

/**
 * Initiates an online fee payment via Flutterwave Hosted Checkout.
 * Strictly adheres to RULES_PAYMENTS, RULES_AUTH, and RULES_LOGGING.
 */
export async function initiateOnlinePayment(
  input: InitiateOnlinePaymentInput,
  options?: InitiatePaymentOptions
): Promise<InitiateOnlinePaymentResult> {
  const session = options?.session !== undefined ? options.session : await getSession();
  if (!session || session.role !== 'parent') {
    return {
      success: false,
      error: 'Authentication required. Only parents may initiate fee payments.',
      code: 'UNAUTHORIZED',
    };
  }

  const { studentId } = input;
  if (!studentId || typeof studentId !== 'string') {
    return {
      success: false,
      error: 'Student ID is required.',
      code: 'INVALID_INPUT',
    };
  }

  // 1. Authorize parent-to-student link (RULES_AUTH Rule 2)
  const authChecker = options?.checkAuthorization ?? checkParentStudentAuthorization;
  const isAuthorized = await authChecker(session.userId, studentId);
  if (!isAuthorized) {
    return {
      success: false,
      error: 'Access denied: You are not authorized to make payments for this student.',
      code: 'FORBIDDEN',
    };
  }

  // 2. Parse and validate amount
  let amountDecimal: Prisma.Decimal;
  try {
    amountDecimal =
      input.amount instanceof Prisma.Decimal ? input.amount : new Prisma.Decimal(input.amount);
    if (!amountDecimal.isFinite() || amountDecimal.lessThanOrEqualTo(0)) {
      throw new Error('invalid amount');
    }
  } catch {
    return {
      success: false,
      error: 'Please enter a valid payment amount.',
      code: 'INVALID_AMOUNT',
    };
  }

  // 3. Minimum payment check (PRD Section 12.5, Section 17, RULES_PAYMENTS Rule 10: ₦1,000)
  if (amountDecimal.lessThan(MIN_ONLINE_PAYMENT_AMOUNT_NGN)) {
    return {
      success: false,
      error: `Minimum online payment amount is ₦${MIN_ONLINE_PAYMENT_AMOUNT_NGN.toLocaleString('en-NG', { minimumFractionDigits: 2 })}.`,
      code: 'MINIMUM_AMOUNT_REQUIRED',
    };
  }

  // 4. Validate amount against outstanding ledger balance
  const balanceValidator = options?.validateAmount ?? validatePaymentAmount;
  let balanceValidation;
  try {
    balanceValidation = await balanceValidator(studentId, amountDecimal, options?.now, {
      minimumAmount: MIN_ONLINE_PAYMENT_AMOUNT_NGN,
    });
  } catch {
    return {
      success: false,
      error:
        'Online payment is currently unavailable because the active academic term calendar is incomplete. Please contact the school office.',
      code: 'CALENDAR_UNCONFIGURED',
    };
  }

  if (!balanceValidation.valid) {
    return {
      success: false,
      error: balanceValidation.error || 'Payment amount exceeds current outstanding balance.',
      code: 'AMOUNT_EXCEEDS_BALANCE',
    };
  }

  const prisma = options?.prismaClient ?? (await import('@/lib/db')).prisma;

  // 5. Verify student existence and leaver status
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    select: { id: true, studentNumber: true, name: true, leftAt: true },
  });

  if (!student || student.leftAt !== null) {
    return {
      success: false,
      error: 'Student record not found or access has ended.',
      code: 'STUDENT_INACTIVE',
    };
  }

  const currentTime = options?.now ?? new Date();
  const idempotencyThreshold = new Date(currentTime.getTime() - IDEMPOTENCY_WINDOW_MS);

  // 6. Idempotency check: Reuse existing PENDING payment if created recently for the same amount
  const existingPendingPayment = await prisma.payment.findFirst({
    where: {
      studentId,
      parentId: session.userId,
      status: PaymentStatus.PENDING,
      amount: amountDecimal,
      createdAt: { gte: idempotencyThreshold },
    },
    orderBy: { createdAt: 'desc' },
  });

  let paymentRecord = existingPendingPayment;
  let internalReference: string;

  if (paymentRecord) {
    internalReference = paymentRecord.internalReference;
  } else {
    internalReference = generateInternalPaymentReference(currentTime);
    paymentRecord = await prisma.payment.create({
      data: {
        studentId,
        parentId: session.userId,
        amount: amountDecimal,
        internalReference,
        status: PaymentStatus.PENDING,
        createdAt: currentTime,
      },
    });
  }

  // 7. Call Flutterwave Hosted Checkout API
  const appBaseUrl =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') || 'http://localhost:3000';
  const redirectUrl =
    input.redirectUrl || `${appBaseUrl}/pay/verify?tx_ref=${encodeURIComponent(internalReference)}`;

  const initiateCaller = options?.initiateCaller ?? callFlutterwaveInitiatePayment;
  const fwRes = await initiateCaller({
    tx_ref: internalReference,
    amount: amountDecimal.toFixed(2),
    currency: 'NGN',
    redirect_url: redirectUrl,
    customer: {
      email: session.user.email,
      name: session.user.name,
    },
    customizations: {
      title: 'SchoolPass School Fees',
      description: `School fee payment for ${student.name} (${student.studentNumber})`,
    },
    meta: {
      studentId: student.id,
      parentId: session.userId,
      internalReference,
    },
  });

  if (fwRes.status !== 'success' || !fwRes.data?.link) {
    return {
      success: false,
      error: fwRes.message || 'Unable to initiate payment with Flutterwave. Please try again.',
      code: 'GATEWAY_ERROR',
      paymentId: paymentRecord.id,
      internalReference,
    };
  }

  // 8. Log structured event (RULES_LOGGING: never log payment amounts or fee balances)
  logEvent({
    level: 'info',
    event: 'payment_initiated',
    actorType: 'parent',
    actorId: session.userId,
    entityType: 'payment',
    entityId: paymentRecord.id,
    outcome: 'success',
    details: {
      internalReference,
    },
  });

  return {
    success: true,
    paymentId: paymentRecord.id,
    internalReference,
    checkoutUrl: fwRes.data.link,
  };
}
