import test, { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Prisma, PaymentStatus } from '@prisma/client';
import {
  verifyFlutterwaveWebhookSignature,
  generateInternalPaymentReference,
  getFlutterwaveEnvironment,
  callFlutterwaveInitiatePayment,
  callFlutterwaveVerifyTransaction,
  MIN_ONLINE_PAYMENT_AMOUNT_NGN,
} from './flutterwave.ts';
import { initiateOnlinePayment } from './api/initiate.ts';
import { verifyPaymentTransaction } from './api/verify.ts';
import { handleFlutterwaveWebhook } from './api/webhook.ts';

const FIXED_DATE = new Date('2026-10-15T10:00:00.000Z');

describe('SchoolPass Phase 4: Flutterwave signature and configuration', () => {
  it('validates matching webhook signatures using timing-safe comparison', () => {
    const secret = 'test_webhook_hash_secret_123';
    assert.equal(verifyFlutterwaveWebhookSignature(secret, secret), true);
  });

  it('rejects invalid or mismatched signatures safely without throwing on length differences', () => {
    const secret = 'secret_length_16';
    assert.equal(verifyFlutterwaveWebhookSignature('secret_length_15', secret), false);
    assert.equal(verifyFlutterwaveWebhookSignature('completely_wrong_secret', secret), false);
    assert.equal(verifyFlutterwaveWebhookSignature('', secret), false);
    assert.equal(verifyFlutterwaveWebhookSignature(null, secret), false);
    assert.equal(verifyFlutterwaveWebhookSignature(undefined, secret), false);
  });

  it('rejects verification when expected webhook secret is unconfigured', () => {
    assert.equal(verifyFlutterwaveWebhookSignature('some_signature', undefined), false);
    assert.equal(verifyFlutterwaveWebhookSignature('some_signature', ''), false);
  });

  it('generates internal payment references adhering to SP-PAY-YYYYMMDD-XXXXXXXX format', () => {
    const ref1 = generateInternalPaymentReference(new Date('2026-11-15T12:00:00.000Z'));
    const ref2 = generateInternalPaymentReference(new Date('2026-11-15T12:00:00.000Z'));

    assert.match(ref1, /^SP-PAY-20261115-[A-F0-9]{8}$/);
    assert.match(ref2, /^SP-PAY-20261115-[A-F0-9]{8}$/);
    assert.notEqual(ref1, ref2, 'Sequential references must have distinct entropy');
  });

  it('detects test and live environments from API key prefixes', () => {
    const origSecret = process.env.FLUTTERWAVE_SECRET_KEY;
    try {
      process.env.FLUTTERWAVE_SECRET_KEY = 'FLWSECK_TEST-123456789';
      assert.equal(getFlutterwaveEnvironment(), 'test');

      process.env.FLUTTERWAVE_SECRET_KEY = 'FLWSECK-987654321';
      assert.equal(getFlutterwaveEnvironment(), 'live');

      delete process.env.FLUTTERWAVE_SECRET_KEY;
      assert.equal(getFlutterwaveEnvironment(), 'unconfigured');
    } finally {
      if (origSecret) {
        process.env.FLUTTERWAVE_SECRET_KEY = origSecret;
      } else {
        delete process.env.FLUTTERWAVE_SECRET_KEY;
      }
    }
  });
});

describe('SchoolPass Phase 4: Flutterwave API client calls', () => {
  it('returns an error when initiating payment without secret key configured', async () => {
    const result = await callFlutterwaveInitiatePayment(
      {
        tx_ref: 'SP-PAY-001',
        amount: '5000.00',
        redirect_url: 'https://example.com/return',
        customer: { email: 'parent@example.com', name: 'Parent User' },
      },
      { secretKey: undefined }
    );

    assert.equal(result.status, 'error');
    assert.match(result.message, /secret key is not configured/i);
  });

  it('successfully calls hosted checkout with valid payload and returns link', async () => {
    const mockFetcher = async (url, options) => {
      assert.equal(url, 'https://api.flutterwave.com/v3/payments');
      assert.equal(options.method, 'POST');
      assert.equal(options.headers.Authorization, 'Bearer FLWSECK_TEST-mock');
      const body = JSON.parse(options.body);
      assert.equal(body.tx_ref, 'SP-PAY-TEST-001');
      assert.equal(body.amount, '15000.00');
      assert.equal(body.currency, 'NGN');

      return {
        ok: true,
        status: 200,
        json: async () => ({
          status: 'success',
          message: 'Hosted Link',
          data: { link: 'https://checkout.flutterwave.com/v3/hosted/pay/test12345' },
        }),
      };
    };

    const result = await callFlutterwaveInitiatePayment(
      {
        tx_ref: 'SP-PAY-TEST-001',
        amount: '15000.00',
        redirect_url: 'https://example.com/verify',
        customer: { email: 'parent@example.com', name: 'John Doe' },
      },
      {
        secretKey: 'FLWSECK_TEST-mock',
        fetchImpl: mockFetcher,
      }
    );

    assert.equal(result.status, 'success');
    assert.equal(result.data.link, 'https://checkout.flutterwave.com/v3/hosted/pay/test12345');
  });

  it('handles gateway timeouts gracefully during initiate', async () => {
    const mockFetcher = async () => {
      const err = new Error('The operation was aborted');
      err.name = 'TimeoutError';
      throw err;
    };

    const result = await callFlutterwaveInitiatePayment(
      {
        tx_ref: 'SP-PAY-TIMEOUT',
        amount: '10000.00',
        redirect_url: 'https://example.com/verify',
        customer: { email: 'p@test.com', name: 'P' },
      },
      {
        secretKey: 'FLWSECK_TEST-mock',
        fetchImpl: mockFetcher,
      }
    );

    assert.equal(result.status, 'error');
    assert.match(result.message, /timed out/i);
  });

  it('calls active transaction verify and parses response', async () => {
    const mockFetcher = async (url, options) => {
      assert.equal(url, 'https://api.flutterwave.com/v3/transactions/987654/verify');
      assert.equal(options.method, 'GET');
      assert.equal(options.headers.Authorization, 'Bearer FLWSECK_TEST-mock');

      return {
        ok: true,
        status: 200,
        json: async () => ({
          status: 'success',
          message: 'Tx Fetched',
          data: {
            id: 987654,
            tx_ref: 'SP-PAY-20261115-ABCDEF01',
            flw_ref: 'FLW-MOCK-REF',
            amount: 25000,
            currency: 'NGN',
            status: 'successful',
          },
        }),
      };
    };

    const result = await callFlutterwaveVerifyTransaction(987654, {
      secretKey: 'FLWSECK_TEST-mock',
      fetchImpl: mockFetcher,
    });

    assert.equal(result.status, 'success');
    assert.equal(result.data.amount, 25000);
    assert.equal(result.data.status, 'successful');
    assert.equal(result.data.currency, 'NGN');
  });
});

describe('SchoolPass Phase 4: Online payment initiation & authorization', () => {
  const parentSession = {
    sessionId: 'session_parent_01',
    userId: 'cparent_001',
    role: 'parent',
    user: { id: 'cparent_001', name: 'Fatima Bello', email: 'fatima@example.com' },
  };

  const staffSession = {
    sessionId: 'session_staff_01',
    userId: 'cstaff_001',
    role: 'staff',
    user: { id: 'cstaff_001', name: 'Staff User', email: 'staff@example.com' },
  };

  function createMockPrisma(overrides = {}) {
    return {
      student: {
        findUnique: async ({ where }) => {
          if (where.id === 'cstudent_leaver') {
            return {
              id: 'cstudent_leaver',
              studentNumber: 'SP-2025-0010',
              name: 'Leaver Student',
              leftAt: new Date('2026-07-01'),
            };
          }
          if (where.id === 'cstudent_unauthorized') {
            return {
              id: 'cstudent_unauthorized',
              studentNumber: 'SP-2026-0099',
              name: 'Other Student',
              leftAt: null,
            };
          }
          return {
            id: 'cstudent_active',
            studentNumber: 'SP-2026-0001',
            name: 'Amina Bello',
            leftAt: null,
          };
        },
      },
      payment: {
        findMany: async () => [],
        findFirst: async () => null,
        create: async ({ data }) => ({
          id: 'pay_created_001',
          ...data,
        }),
      },
      ...overrides,
    };
  }

  const mockAuthChecker = async (parentId, studentId) => {
    return parentId === 'cparent_001' && studentId !== 'cstudent_unauthorized';
  };

  const mockBalanceValidator = async (studentId, amount) => {
    const num = Number(amount);
    if (num > 50000) {
      return { valid: false, error: 'Payment amount exceeds current outstanding balance.' };
    }
    return { valid: true };
  };

  it('blocks unauthenticated callers from initiating payments', async () => {
    const res = await initiateOnlinePayment(
      { studentId: 'cstudent_active', amount: '10000' },
      { session: null }
    );
    assert.equal(res.success, false);
    assert.equal(res.code, 'UNAUTHORIZED');
  });

  it('blocks staff and admin from initiating parent online checkout', async () => {
    const res = await initiateOnlinePayment(
      { studentId: 'cstudent_active', amount: '10000' },
      { session: staffSession }
    );
    assert.equal(res.success, false);
    assert.equal(res.code, 'UNAUTHORIZED');
  });

  it('blocks parents from initiating payments for non-linked students (RULES_AUTH)', async () => {
    const prisma = createMockPrisma();
    const res = await initiateOnlinePayment(
      { studentId: 'cstudent_unauthorized', amount: '10000' },
      {
        session: parentSession,
        prismaClient: prisma,
        checkAuthorization: mockAuthChecker,
        validateAmount: mockBalanceValidator,
        now: FIXED_DATE,
      }
    );
    assert.equal(res.success, false);
    assert.equal(res.code, 'FORBIDDEN');
  });

  it('enforces minimum online payment threshold of ₦1,000.00', async () => {
    const prisma = createMockPrisma();
    const res = await initiateOnlinePayment(
      { studentId: 'cstudent_active', amount: '950.00' },
      {
        session: parentSession,
        prismaClient: prisma,
        checkAuthorization: mockAuthChecker,
        validateAmount: mockBalanceValidator,
        now: FIXED_DATE,
      }
    );
    assert.equal(res.success, false);
    assert.equal(res.code, 'MINIMUM_AMOUNT_REQUIRED');
  });

  it('blocks payment amounts that exceed the student outstanding ledger balance', async () => {
    const prisma = createMockPrisma();
    // Outstanding balance is ₦50,000; attempting ₦60,000
    const res = await initiateOnlinePayment(
      { studentId: 'cstudent_active', amount: '60000.00' },
      {
        session: parentSession,
        prismaClient: prisma,
        checkAuthorization: mockAuthChecker,
        validateAmount: mockBalanceValidator,
        now: FIXED_DATE,
      }
    );
    assert.equal(res.success, false);
    assert.equal(res.code, 'AMOUNT_EXCEEDS_BALANCE');
  });

  it('blocks payments for students marked as leavers (leftAt !== null)', async () => {
    const prisma = createMockPrisma();
    const res = await initiateOnlinePayment(
      { studentId: 'cstudent_leaver', amount: '5000.00' },
      {
        session: parentSession,
        prismaClient: prisma,
        checkAuthorization: mockAuthChecker,
        validateAmount: mockBalanceValidator,
        now: FIXED_DATE,
      }
    );
    assert.equal(res.success, false);
    assert.equal(res.code, 'STUDENT_INACTIVE');
  });

  it('creates PENDING record and initiates Flutterwave payment successfully', async () => {
    let createdRecord = null;
    const prisma = createMockPrisma({
      payment: {
        findMany: async () => [],
        findFirst: async () => null,
        create: async ({ data }) => {
          createdRecord = { id: 'pay_new_123', ...data };
          return createdRecord;
        },
      },
    });

    const mockInitiate = async (payload) => {
      assert.equal(payload.amount, '20000.00');
      assert.equal(payload.currency, 'NGN');
      assert.equal(payload.customer.email, 'fatima@example.com');
      return {
        status: 'success',
        message: 'Link generated',
        data: { link: 'https://checkout.flutterwave.com/v3/hosted/pay/mock_link' },
      };
    };

    const res = await initiateOnlinePayment(
      { studentId: 'cstudent_active', amount: '20000.00' },
      {
        session: parentSession,
        prismaClient: prisma,
        checkAuthorization: mockAuthChecker,
        validateAmount: mockBalanceValidator,
        initiateCaller: mockInitiate,
        now: FIXED_DATE,
      }
    );

    assert.equal(res.success, true);
    assert.equal(res.checkoutUrl, 'https://checkout.flutterwave.com/v3/hosted/pay/mock_link');
    assert.equal(createdRecord.status, PaymentStatus.PENDING);
    assert.equal(createdRecord.amount.toString(), '20000');
    assert.match(createdRecord.internalReference, /^SP-PAY-20261015-/);
  });

  it('re-uses recent PENDING payment for identical amount within 15 minutes (RULES_PAYMENTS Rule 5)', async () => {
    const existingPayment = {
      id: 'pay_existing_pending',
      studentId: 'cstudent_active',
      parentId: 'cparent_001',
      amount: new Prisma.Decimal('15000.00'),
      internalReference: 'SP-PAY-20261015-EXISTING',
      status: PaymentStatus.PENDING,
      createdAt: new Date('2026-10-15T09:50:00.000Z'), // 10 minutes ago
    };

    let createCalled = false;
    const prisma = createMockPrisma({
      payment: {
        findMany: async () => [],
        findFirst: async () => existingPayment,
        create: async () => {
          createCalled = true;
          throw new Error('Should not create new record');
        },
      },
    });

    const mockInitiate = async (payload) => {
      assert.equal(payload.tx_ref, 'SP-PAY-20261015-EXISTING');
      return {
        status: 'success',
        message: 'Reused link',
        data: { link: 'https://checkout.flutterwave.com/reused' },
      };
    };

    const res = await initiateOnlinePayment(
      { studentId: 'cstudent_active', amount: '15000.00' },
      {
        session: parentSession,
        prismaClient: prisma,
        checkAuthorization: mockAuthChecker,
        validateAmount: mockBalanceValidator,
        initiateCaller: mockInitiate,
        now: FIXED_DATE,
      }
    );

    assert.equal(res.success, true);
    assert.equal(createCalled, false, 'Did not create a duplicate Payment record');
    assert.equal(res.internalReference, 'SP-PAY-20261015-EXISTING');
    assert.equal(res.paymentId, 'pay_existing_pending');
  });
});

describe('SchoolPass Phase 4: Server-side active verification & invariants', () => {
  function createVerifyPrisma(paymentRecord) {
    let currentPayment = paymentRecord ? { ...paymentRecord } : null;
    let updateManyCalls = [];

    return {
      prisma: {
        payment: {
          findUnique: async ({ where }) => {
            if (currentPayment && where.internalReference === currentPayment.internalReference) {
              return currentPayment;
            }
            return null;
          },
          updateMany: async ({ where, data }) => {
            updateManyCalls.push({ where, data });
            if (currentPayment && currentPayment.id === where.id && currentPayment.status === where.status) {
              currentPayment.status = data.status;
              if (data.flutterwaveReference) {
                currentPayment.flutterwaveReference = data.flutterwaveReference;
              }
              if (data.verifiedAt) {
                currentPayment.verifiedAt = data.verifiedAt;
              }
              return { count: 1 };
            }
            return { count: 0 };
          },
        },
      },
      getCurrentPayment: () => currentPayment,
      getUpdateManyCalls: () => updateManyCalls,
    };
  }

  it('idempotently returns success when payment is already SUCCESSFUL', async () => {
    const existing = {
      id: 'pay_success_1',
      internalReference: 'SP-PAY-DONE-001',
      amount: new Prisma.Decimal('30000.00'),
      status: PaymentStatus.SUCCESSFUL,
    };

    const { prisma } = createVerifyPrisma(existing);

    const mockVerify = async () => ({
      status: 'success',
      message: 'Verified',
      data: {
        id: 111,
        tx_ref: 'SP-PAY-DONE-001',
        flw_ref: 'FLW-111',
        amount: 30000,
        currency: 'NGN',
        status: 'successful',
      },
    });

    const res = await verifyPaymentTransaction(111, 'SP-PAY-DONE-001', {
      prismaClient: prisma,
      verifyCaller: mockVerify,
    });

    assert.equal(res.success, true);
    assert.equal(res.alreadyProcessed, true);
    assert.equal(res.status, PaymentStatus.SUCCESSFUL);
  });

  it('marks payment FAILED if gateway transaction status is not successful', async () => {
    const pending = {
      id: 'pay_pend_fail',
      internalReference: 'SP-PAY-FAIL-001',
      amount: new Prisma.Decimal('10000.00'),
      status: PaymentStatus.PENDING,
    };

    const { prisma, getCurrentPayment } = createVerifyPrisma(pending);

    const mockVerify = async () => ({
      status: 'success',
      message: 'Fetched',
      data: {
        id: 222,
        tx_ref: 'SP-PAY-FAIL-001',
        flw_ref: 'FLW-222',
        amount: 10000,
        currency: 'NGN',
        status: 'failed', // Failed at card gateway
      },
    });

    const res = await verifyPaymentTransaction(222, 'SP-PAY-FAIL-001', {
      prismaClient: prisma,
      verifyCaller: mockVerify,
    });

    assert.equal(res.success, false);
    assert.equal(res.code, 'TRANSACTION_NOT_SUCCESSFUL');
    assert.equal(getCurrentPayment().status, PaymentStatus.FAILED);
  });

  it('marks payment FAILED on currency mismatch (RULES_PAYMENTS Rule 11)', async () => {
    const pending = {
      id: 'pay_curr_mis',
      internalReference: 'SP-PAY-USD-001',
      amount: new Prisma.Decimal('25000.00'),
      status: PaymentStatus.PENDING,
    };

    const { prisma, getCurrentPayment } = createVerifyPrisma(pending);

    const mockVerify = async () => ({
      status: 'success',
      message: 'Fetched',
      data: {
        id: 333,
        tx_ref: 'SP-PAY-USD-001',
        flw_ref: 'FLW-333',
        amount: 25000,
        currency: 'USD', // Currency mismatch!
        status: 'successful',
      },
    });

    const res = await verifyPaymentTransaction(333, 'SP-PAY-USD-001', {
      prismaClient: prisma,
      verifyCaller: mockVerify,
    });

    assert.equal(res.success, false);
    assert.equal(res.code, 'CURRENCY_MISMATCH');
    assert.equal(getCurrentPayment().status, PaymentStatus.FAILED);
  });

  it('marks payment FAILED on underpayment (amount mismatch)', async () => {
    const pending = {
      id: 'pay_amt_mis',
      internalReference: 'SP-PAY-AMT-001',
      amount: new Prisma.Decimal('40000.00'),
      status: PaymentStatus.PENDING,
    };

    const { prisma, getCurrentPayment } = createVerifyPrisma(pending);

    const mockVerify = async () => ({
      status: 'success',
      message: 'Fetched',
      data: {
        id: 444,
        tx_ref: 'SP-PAY-AMT-001',
        flw_ref: 'FLW-444',
        amount: 20000, // Underpayment: expected 40,000
        currency: 'NGN',
        status: 'successful',
      },
    });

    const res = await verifyPaymentTransaction(444, 'SP-PAY-AMT-001', {
      prismaClient: prisma,
      verifyCaller: mockVerify,
    });

    assert.equal(res.success, false);
    assert.equal(res.code, 'AMOUNT_MISMATCH');
    assert.equal(getCurrentPayment().status, PaymentStatus.FAILED);
  });

  it('atomically transitions PENDING to SUCCESSFUL when all invariants hold', async () => {
    const pending = {
      id: 'pay_valid_001',
      internalReference: 'SP-PAY-OK-001',
      amount: new Prisma.Decimal('35000.00'),
      status: PaymentStatus.PENDING,
    };

    const { prisma, getCurrentPayment } = createVerifyPrisma(pending);

    const mockVerify = async () => ({
      status: 'success',
      message: 'Verified',
      data: {
        id: 555,
        tx_ref: 'SP-PAY-OK-001',
        flw_ref: 'FLW-555',
        amount: 35000,
        currency: 'NGN',
        status: 'successful',
      },
    });

    const res = await verifyPaymentTransaction(555, 'SP-PAY-OK-001', {
      prismaClient: prisma,
      verifyCaller: mockVerify,
      now: FIXED_DATE,
    });

    assert.equal(res.success, true);
    assert.equal(res.status, PaymentStatus.SUCCESSFUL);
    const updated = getCurrentPayment();
    assert.equal(updated.status, PaymentStatus.SUCCESSFUL);
    assert.equal(updated.flutterwaveReference, '555');
    assert.equal(updated.verifiedAt, FIXED_DATE);
  });
});

describe('SchoolPass Phase 4: Webhook handler & security', () => {
  const SECRET = 'secret_webhook_test_hash_2026';

  function createMockRequest(headers, body) {
    const headerMap = new Map(Object.entries(headers));
    return {
      headers: {
        get: (key) => headerMap.get(key.toLowerCase()) || headerMap.get(key) || null,
      },
      json: async () => body,
    };
  }

  it('returns HTTP 401 when verif-hash header does not match secret', async () => {
    const req = createMockRequest(
      { 'verif-hash': 'invalid_signature_hash' },
      { event: 'charge.completed' }
    );

    const res = await handleFlutterwaveWebhook(req, {
      webhookSecret: SECRET,
    });

    assert.equal(res.status, 401);
    const body = await res.json();
    assert.match(body.error, /invalid signature/i);
  });

  it('returns HTTP 401 when verif-hash header is completely missing', async () => {
    const req = createMockRequest({}, { event: 'charge.completed' });

    const res = await handleFlutterwaveWebhook(req, {
      webhookSecret: SECRET,
    });

    assert.equal(res.status, 401);
  });

  it('handles duplicate webhook delivery idempotently with HTTP 200 without double-crediting', async () => {
    const req = createMockRequest(
      { 'verif-hash': SECRET },
      {
        event: 'charge.completed',
        data: {
          id: 777,
          tx_ref: 'SP-PAY-DUPLICATE-001',
          status: 'successful',
        },
      }
    );

    let verifyCallCount = 0;
    const mockVerify = async (txId, txRef) => {
      verifyCallCount++;
      return {
        success: true,
        paymentId: 'pay_dup_001',
        internalReference: txRef,
        alreadyProcessed: true,
      };
    };

    const res = await handleFlutterwaveWebhook(req, {
      webhookSecret: SECRET,
      verifyFn: mockVerify,
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.status, 'success');
    assert.equal(body.alreadyProcessed, true);
    assert.equal(verifyCallCount, 1);
  });

  it('processes valid charge.completed webhook and confirms payment', async () => {
    const req = createMockRequest(
      { 'verif-hash': SECRET },
      {
        event: 'charge.completed',
        data: {
          id: 888,
          tx_ref: 'SP-PAY-WEBHOOK-001',
          status: 'successful',
        },
      }
    );

    let passedTxId = null;
    let passedRef = null;

    const mockVerify = async (txId, txRef) => {
      passedTxId = txId;
      passedRef = txRef;
      return {
        success: true,
        paymentId: 'pay_web_001',
        internalReference: txRef,
        alreadyProcessed: false,
      };
    };

    const res = await handleFlutterwaveWebhook(req, {
      webhookSecret: SECRET,
      verifyFn: mockVerify,
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.status, 'success');
    assert.equal(body.alreadyProcessed, false);
    assert.equal(passedTxId, 888);
    assert.equal(passedRef, 'SP-PAY-WEBHOOK-001');
  });
});
