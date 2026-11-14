import 'server-only';
import { logEvent } from '@/lib/logging';
import {
  verifyFlutterwaveWebhookSignature,
  type FlutterwaveWebhookPayload,
} from '../flutterwave';
import { verifyPaymentTransaction, type VerifyPaymentOptions } from './verify';

export interface WebhookHandlerOptions extends VerifyPaymentOptions {
  webhookSecret?: string;
  verifyFn?: typeof verifyPaymentTransaction;
}

/**
 * Handles incoming Flutterwave webhook notifications (POST /api/payments/webhook).
 * Enforces RULES_PAYMENTS Rules 7 and 8:
 * - Strict timing-safe verif-hash signature verification.
 * - Idempotent processing: receiving the same event twice never double-updates the balance.
 * - Server-side active verification call ensures payload integrity.
 */
export async function handleFlutterwaveWebhook(
  request: Request,
  options?: WebhookHandlerOptions
): Promise<Response> {
  const signatureHeader = request.headers.get('verif-hash');

  // 1. Signature verification (RULES_PAYMENTS Rule 8)
  const isSignatureValid = verifyFlutterwaveWebhookSignature(
    signatureHeader,
    options?.webhookSecret
  );

  if (!isSignatureValid) {
    logEvent({
      level: 'warn',
      event: 'payment_webhook_rejected_signature',
      actorType: 'system',
      outcome: 'failure',
    });

    return new Response(JSON.stringify({ error: 'Unauthorized: Invalid signature' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // 2. Parse request JSON body
  let payload: FlutterwaveWebhookPayload;
  try {
    payload = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON payload' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const transactionData = payload?.data;
  if (!transactionData || !transactionData.id || !transactionData.tx_ref) {
    // Acknowledge receipt of unknown or irrelevant webhooks so Flutterwave stops retrying
    return new Response(
      JSON.stringify({ status: 'ignored', message: 'Payload missing transaction id or tx_ref' }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  const transactionId = transactionData.id;
  const internalReference = transactionData.tx_ref;

  // 3. Actively verify transaction against Flutterwave API and update ledger idempotently
  const verifyFn = options?.verifyFn ?? verifyPaymentTransaction;
  const verifyResult = await verifyFn(transactionId, internalReference, options);

  if (!verifyResult.success && verifyResult.code === 'PAYMENT_NOT_FOUND') {
    // If the payment is not found in our database, return 200 so Flutterwave does not retry indefinitely
    return new Response(
      JSON.stringify({ status: 'ignored', message: 'Payment record not found' }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  return new Response(
    JSON.stringify({
      status: verifyResult.success ? 'success' : 'failed',
      internalReference,
      alreadyProcessed: verifyResult.alreadyProcessed ?? false,
    }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }
  );
}

