import 'server-only';
import crypto from 'node:crypto';

export const FLUTTERWAVE_API_BASE_URL = 'https://api.flutterwave.com/v3';
export const FLUTTERWAVE_DEFAULT_TIMEOUT_MS = 15000;
export const MIN_ONLINE_PAYMENT_AMOUNT_NGN = 1000;

export interface FlutterwaveCustomerInfo {
  email: string;
  name: string;
  phoneNumber?: string;
}

export interface FlutterwaveCustomizations {
  title?: string;
  description?: string;
  logo?: string;
}

export interface FlutterwaveInitiatePayload {
  tx_ref: string;
  amount: string | number;
  currency?: string;
  redirect_url: string;
  customer: FlutterwaveCustomerInfo;
  customizations?: FlutterwaveCustomizations;
  meta?: Record<string, string | number | boolean>;
}

export interface FlutterwaveInitiateApiResponse {
  status: 'success' | 'error';
  message: string;
  data?: {
    link: string;
  };
}

export interface FlutterwaveTransactionVerifyData {
  id: number;
  tx_ref: string;
  flw_ref: string;
  amount: number;
  currency: string;
  status: string; // 'successful' | 'failed' | ...
  payment_type?: string;
  created_at?: string;
  customer?: {
    id?: number;
    name?: string;
    email?: string;
    phone_number?: string;
  };
}

export interface FlutterwaveVerifyApiResponse {
  status: 'success' | 'error';
  message: string;
  data?: FlutterwaveTransactionVerifyData;
}

export interface FlutterwaveWebhookPayload {
  event: string;
  data: {
    id: number;
    tx_ref: string;
    flw_ref?: string;
    amount: number;
    currency: string;
    status: string;
    customer?: {
      email?: string;
      name?: string;
    };
  };
}

/**
 * Access Flutterwave credentials from the environment.
 */
export function getFlutterwavePublicKey(): string | undefined {
  return process.env.FLUTTERWAVE_PUBLIC_KEY?.trim() || undefined;
}

export function getFlutterwaveSecretKey(): string | undefined {
  return process.env.FLUTTERWAVE_SECRET_KEY?.trim() || undefined;
}

export function getFlutterwaveWebhookSecret(): string | undefined {
  return process.env.FLUTTERWAVE_WEBHOOK_SECRET?.trim() || undefined;
}

/**
 * Returns true if both public and secret keys are available.
 */
export function isFlutterwaveConfigured(): boolean {
  return Boolean(getFlutterwavePublicKey() && getFlutterwaveSecretKey());
}

/**
 * Returns true if webhook secret hash is configured.
 */
export function isFlutterwaveWebhookConfigured(): boolean {
  return Boolean(getFlutterwaveWebhookSecret());
}

/**
 * Returns the environment mode of the configured secret key.
 */
export function getFlutterwaveEnvironment(): 'test' | 'live' | 'unconfigured' {
  const secretKey = getFlutterwaveSecretKey();
  if (!secretKey) return 'unconfigured';
  if (secretKey.startsWith('FLWSECK_TEST-')) return 'test';
  if (secretKey.startsWith('FLWSECK-')) return 'live';
  return 'unconfigured';
}

/**
 * Timing-safe signature check against FLUTTERWAVE_WEBHOOK_SECRET (RULES_PAYMENTS Rule 8).
 * Uses crypto.timingSafeEqual with length matching to prevent timing attacks.
 */
export function verifyFlutterwaveWebhookSignature(
  signatureHeader: string | null | undefined,
  customSecret?: string
): boolean {
  const expectedSecret = customSecret ?? getFlutterwaveWebhookSecret();
  if (!expectedSecret || !signatureHeader) {
    return false;
  }

  const headerBuf = Buffer.from(signatureHeader, 'utf8');
  const secretBuf = Buffer.from(expectedSecret, 'utf8');

  if (headerBuf.length !== secretBuf.length) {
    return false;
  }

  return crypto.timingSafeEqual(headerBuf, secretBuf);
}

/**
 * Generates an internal payment reference in the standard SchoolPass format:
 * SP-PAY-YYYYMMDD-XXXXXXXX
 */
export function generateInternalPaymentReference(now = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const dateStr = `${year}${month}${day}`;
  const entropy = crypto.randomBytes(4).toString('hex').toUpperCase();
  return `SP-PAY-${dateStr}-${entropy}`;
}

/**
 * Calls Flutterwave Standard Hosted Checkout API (POST /v3/payments).
 */
export async function callFlutterwaveInitiatePayment(
  payload: FlutterwaveInitiatePayload,
  options?: {
    secretKey?: string;
    baseUrl?: string;
    timeoutMs?: number;
    fetchImpl?: typeof fetch;
  }
): Promise<FlutterwaveInitiateApiResponse> {
  const secretKey = options?.secretKey ?? getFlutterwaveSecretKey();
  if (!secretKey) {
    return {
      status: 'error',
      message: 'Flutterwave secret key is not configured on the server.',
    };
  }

  const baseUrl = options?.baseUrl ?? FLUTTERWAVE_API_BASE_URL;
  const timeoutMs = options?.timeoutMs ?? FLUTTERWAVE_DEFAULT_TIMEOUT_MS;
  const fetcher = options?.fetchImpl ?? fetch;

  try {
    const res = await fetcher(`${baseUrl}/payments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${secretKey}`,
      },
      body: JSON.stringify({
        ...payload,
        currency: payload.currency ?? 'NGN',
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });

    const json = (await res.json().catch(() => null)) as FlutterwaveInitiateApiResponse | null;
    if (!res.ok || !json) {
      return {
        status: 'error',
        message: json?.message || `Flutterwave API error (HTTP ${res.status}).`,
      };
    }

    return json;
  } catch (err: unknown) {
    const isTimeout =
      err instanceof Error && (err.name === 'TimeoutError' || err.name === 'AbortError');
    return {
      status: 'error',
      message: isTimeout
        ? 'Flutterwave connection timed out. Please try again.'
        : 'Network error communicating with Flutterwave payment gateway.',
    };
  }
}

/**
 * Actively queries Flutterwave to verify a transaction (GET /v3/transactions/:id/verify).
 * Enforces RULES_PAYMENTS Rule 6: server-side verification is the only source of truth.
 */
export async function callFlutterwaveVerifyTransaction(
  transactionId: string | number,
  options?: {
    secretKey?: string;
    baseUrl?: string;
    timeoutMs?: number;
    fetchImpl?: typeof fetch;
  }
): Promise<FlutterwaveVerifyApiResponse> {
  const cleanId = String(transactionId).trim();
  if (!cleanId) {
    return {
      status: 'error',
      message: 'Transaction ID is required for verification.',
    };
  }

  const secretKey = options?.secretKey ?? getFlutterwaveSecretKey();
  if (!secretKey) {
    return {
      status: 'error',
      message: 'Flutterwave secret key is not configured on the server.',
    };
  }

  const baseUrl = options?.baseUrl ?? FLUTTERWAVE_API_BASE_URL;
  const timeoutMs = options?.timeoutMs ?? FLUTTERWAVE_DEFAULT_TIMEOUT_MS;
  const fetcher = options?.fetchImpl ?? fetch;

  try {
    const res = await fetcher(`${baseUrl}/transactions/${encodeURIComponent(cleanId)}/verify`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${secretKey}`,
      },
      signal: AbortSignal.timeout(timeoutMs),
    });

    const json = (await res.json().catch(() => null)) as FlutterwaveVerifyApiResponse | null;
    if (!res.ok || !json) {
      return {
        status: 'error',
        message: json?.message || `Flutterwave API verification error (HTTP ${res.status}).`,
      };
    }

    return json;
  } catch (err: unknown) {
    const isTimeout =
      err instanceof Error && (err.name === 'TimeoutError' || err.name === 'AbortError');
    return {
      status: 'error',
      message: isTimeout
        ? 'Flutterwave verification timed out.'
        : 'Network error verifying transaction with Flutterwave.',
    };
  }
}

