import test, { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';
import {
  OfflineEntryError,
  adjustmentSchema,
  buildOfflineReferenceMarker,
  formatAdjustmentNote,
  formatOfflinePaymentNote,
  normalizeSignedFeeAmount,
  offlinePaymentSchema,
  parseAdjustmentNote,
  parseOfflinePaymentNote,
  projectFrontDeskStudent,
  resolveCurrentTermId,
} from './offline.ts';

function calendar(overrides = {}) {
  return {
    currentTermId: null,
    terms: [
      { termId: '2026/2027-T1', name: 'First Term', startDate: '2026-09-01T00:00:00.000Z' },
      { termId: '2026/2027-T2', name: 'Second Term', startDate: '2027-01-10T00:00:00.000Z' },
    ],
    ...overrides,
  };
}

describe('SchoolPass Phase 3: offline payment validation', () => {
  it('normalizes positive offline payment amounts and accepts valid methods', () => {
    const result = offlinePaymentSchema.safeParse({
      studentId: 'cstudent123456789',
      amount: '45000',
      method: 'BANK_TRANSFER',
      reference: 'TRX-2026-001',
      note: 'Deposit slip received at the school bank.',
    });

    assert.equal(result.success, true);
    assert.equal(result.data.amount, '45000.00');
    assert.equal(result.data.method, 'BANK_TRANSFER');
  });

  it('rejects missing references, pipe characters, invalid methods, and non-positive amounts', () => {
    const base = {
      studentId: 'cstudent123456789',
      amount: '5000',
      method: 'CASH',
      reference: 'RCPT-100',
      note: 'Cash received by the bursar.',
    };

    assert.equal(
      offlinePaymentSchema.safeParse({ ...base, reference: 'RCPT|100' }).success,
      false
    );
    assert.equal(offlinePaymentSchema.safeParse({ ...base, reference: '' }).success, false);
    assert.equal(offlinePaymentSchema.safeParse({ ...base, method: 'CARD' }).success, false);
    assert.equal(offlinePaymentSchema.safeParse({ ...base, amount: '0' }).success, false);
    assert.equal(offlinePaymentSchema.safeParse({ ...base, amount: '-100' }).success, false);
    assert.equal(
      offlinePaymentSchema.safeParse({ ...base, amount: '100.999' }).success,
      false
    );
  });

  it('normalizes signed adjustment amounts and rejects zero', () => {
    assert.equal(normalizeSignedFeeAmount('-5000'), '-5000.00');
    assert.equal(normalizeSignedFeeAmount('-0.5'), '-0.50');
    assert.equal(normalizeSignedFeeAmount('2500.5'), '2500.50');

    const base = {
      studentId: 'cstudent123456789',
      note: 'Approved by the school administrator.',
    };

    assert.equal(adjustmentSchema.safeParse({ ...base, amount: '-5000' }).success, true);
    assert.equal(adjustmentSchema.safeParse({ ...base, amount: '2500' }).success, true);
    assert.equal(adjustmentSchema.safeParse({ ...base, amount: '0' }).success, false);
    assert.equal(adjustmentSchema.safeParse({ ...base, amount: '0.00' }).success, false);
  });

  it('formats and parses offline payment details without losing the note', () => {
    const note = formatOfflinePaymentNote({
      method: 'TELLER',
      reference: 'TELLER/2026/001',
      note: 'Paid at the bank | branch copy retained.',
    });

    assert.match(note, /^Offline payment \(Teller\) \| Ref: TELLER\/2026\/001 \| Note: /);
    assert.equal(buildOfflineReferenceMarker('TELLER/2026/001'), '| Ref: TELLER/2026/001 |');

    assert.deepEqual(parseOfflinePaymentNote(note), {
      method: 'TELLER',
      reference: 'TELLER/2026/001',
      note: 'Paid at the bank | branch copy retained.',
    });
    assert.equal(parseOfflinePaymentNote('Manual note only'), null);
  });

  it('formats and parses signed adjustment details', () => {
    const creditNote = formatAdjustmentNote({
      amount: '-5000.00',
      note: 'Approved fee waiver.',
    });
    const debitNote = formatAdjustmentNote({
      amount: '2500.00',
      note: 'Correction for a missed charge.',
    });

    assert.deepEqual(parseAdjustmentNote(creditNote), {
      direction: 'credit',
      note: 'Approved fee waiver.',
    });
    assert.deepEqual(parseAdjustmentNote(debitNote), {
      direction: 'debit',
      note: 'Correction for a missed charge.',
    });
    assert.equal(parseAdjustmentNote('Unstructured note'), null);
  });
});

describe('SchoolPass Phase 3: current term resolution', () => {
  const asOfDate = new Date('2027-02-01T00:00:00.000Z');

  it('uses the explicitly configured current term', () => {
    assert.equal(
      resolveCurrentTermId(calendar({ currentTermId: '2026/2027-T1' }), asOfDate),
      '2026/2027-T1'
    );
  });

  it('falls back to the latest started term when none is explicit', () => {
    assert.equal(resolveCurrentTermId(calendar(), asOfDate), '2026/2027-T2');
    assert.equal(
      resolveCurrentTermId(calendar(), new Date('2026-10-01T00:00:00.000Z')),
      '2026/2027-T1'
    );
  });

  it('returns null when no configured term has started', () => {
    assert.equal(
      resolveCurrentTermId(calendar(), new Date('2026-01-01T00:00:00.000Z')),
      null
    );
  });

  it('rejects a configured current term that is missing or future-dated', () => {
    assert.throws(
      () => resolveCurrentTermId(calendar({ currentTermId: '2026/2027-T9' }), asOfDate),
      OfflineEntryError
    );
    assert.throws(
      () =>
        resolveCurrentTermId(
          calendar({ currentTermId: '2026/2027-T2' }),
          new Date('2026-12-01T00:00:00.000Z')
        ),
      OfflineEntryError
    );
  });
});

const authMockSource = `
let state = { authorized: false, error: 'Authentication required.' };
export function __setAuth(next) { state = next; }
export async function assertAdminSession() { return state; }
export async function getConfiguredClasses() { throw new Error('DB_ACCESS_NOT_ALLOWED'); }
export async function getConfiguredSessions() { throw new Error('DB_ACCESS_NOT_ALLOWED'); }
`;

const loaderSource = `
export async function resolve(specifier, context, nextResolve) {
  if (specifier === '@/lib/auth') {
    return {
      url: 'data:text/javascript,' + encodeURIComponent(${JSON.stringify(authMockSource)}),
      shortCircuit: true,
    };
  }
  if (specifier === '@/lib/logging') {
    return {
      url: 'data:text/javascript,export%20function%20logEvent()%20%7B%7D',
      shortCircuit: true,
    };
  }
  return nextResolve(specifier, context);
}
`;

register('data:text/javascript,' + encodeURIComponent(loaderSource), import.meta.url);

const authMock = await import('@/lib/auth');
const feeActions = await import('@/app/(staff)/payments/actions');

const actionCalls = [
  [
    'offline payment',
    () =>
      feeActions.recordOfflinePaymentAction(
        'cstudent123456789',
        '5000',
        'CASH',
        'RCPT-100',
        'Cash received by the bursar.'
      ),
  ],
  [
    'adjustment',
    () =>
      feeActions.recordAdjustmentAction(
        'cstudent123456789',
        '-5000',
        'Approved fee waiver.'
      ),
  ],
];

describe('SchoolPass Phase 3: Front Desk data minimisation', () => {
  it('projects only directory identity and outstanding balance fields', () => {
    const projected = projectFrontDeskStudent(
      {
        id: 'cstudent123456789',
        studentNumber: 'SP-001',
        name: 'Test Student',
        className: 'Primary 4',
        summary: { amountDue: '1000.00', termBreakdown: [] },
        history: [{ id: 'entry-1', amount: '1000.00' }],
        notes: 'private staff note',
        recordedBy: 'Staff Name',
      },
      '25000.00',
      'Some entries could not be valued.'
    );

    assert.deepEqual(Object.keys(projected).sort(), [
      'balanceError',
      'className',
      'id',
      'name',
      'outstandingBalance',
      'studentNumber',
    ]);
    assert.equal(projected.outstandingBalance, '25000.00');
    assert.equal('summary' in projected, false);
    assert.equal('history' in projected, false);
    assert.equal('notes' in projected, false);
    assert.equal('recordedBy' in projected, false);
  });

  it('omits balanceError when no error is supplied', () => {
    const projected = projectFrontDeskStudent(
      {
        id: 'cstudent123456789',
        studentNumber: 'SP-001',
        name: 'Test Student',
        className: 'Primary 4',
      },
      null
    );

    assert.equal('balanceError' in projected, false);
    assert.equal(projected.outstandingBalance, null);
  });
});

describe('SchoolPass Phase 3: admin-only financial actions', () => {
  it('rejects unauthenticated callers before validation or data access', async () => {
    authMock.__setAuth({ authorized: false, error: 'Authentication required.' });

    for (const [name, call] of actionCalls) {
      const result = await call();
      assert.equal(result.success, false, name);
      assert.equal(result.errorCode, 'session_expired', name);
      assert.match(result.error, /session has expired/i, name);
    }
  });

  it('rejects authenticated non-admin staff before data access', async () => {
    authMock.__setAuth({
      authorized: false,
      session: { role: 'staff', userId: 'cstaffuser123456789' },
      error: 'Unauthorized. Admin privileges required.',
    });

    for (const [name, call] of actionCalls) {
      const result = await call();
      assert.equal(result.success, false, name);
      assert.equal(result.errorCode, 'unauthorized', name);
      assert.match(result.error, /admin privileges/i, name);
    }
  });

  it('validates financial payloads after admin authentication without touching the database', async () => {
    authMock.__setAuth({
      authorized: true,
      session: { role: 'admin', userId: 'cadminuser123456789' },
    });

    const invalidOffline = await feeActions.recordOfflinePaymentAction(
      'bad-id',
      '0',
      'CARD',
      '',
      ''
    );
    const invalidAdjustment = await feeActions.recordAdjustmentAction('bad-id', '0', '');

    for (const result of [invalidOffline, invalidAdjustment]) {
      assert.equal(result.success, false);
      assert.equal(result.errorCode, 'validation');
    }
  });

  it('exposes safe domain error codes', () => {
    const error = new OfflineEntryError(
      'conflict',
      'This payment reference has already been recorded for this student.'
    );

    assert.equal(error.code, 'conflict');
    assert.equal(error.name, 'OfflineEntryError');
  });
});
