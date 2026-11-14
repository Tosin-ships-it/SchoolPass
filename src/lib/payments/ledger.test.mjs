import test, { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Prisma } from '@prisma/client';
import {
  LedgerConfigurationError,
  LedgerValidationError,
  calculateStudentBalance,
  evaluateDeletionGuard,
  parseTermCalendarValue,
  validatePaymentAmountAgainstBalance,
} from './ledger.ts';

const ZERO = '0';
const AS_OF = new Date('2027-03-01T12:00:00.000Z');

const TERMS = [
  { termId: '2026/2027-T1', name: 'First Term', startDate: '2026-09-01T00:00:00.000Z' },
  { termId: '2026/2027-T2', name: 'Second Term', startDate: '2027-01-10T00:00:00.000Z' },
  { termId: '2026/2027-T3', name: 'Third Term', startDate: '2027-04-20T00:00:00.000Z' },
];

function money(value) {
  return new Prisma.Decimal(value);
}

function entry(termId, type, amount, extra = {}) {
  return {
    termId,
    type,
    amount: money(amount),
    ...extra,
  };
}

function payment(amount, status = 'SUCCESSFUL', refunds = [], extra = {}) {
  return {
    amount: money(amount),
    status,
    refunds,
    ...extra,
  };
}

function refund(amount, status = 'CONFIRMED') {
  return { amount: money(amount), status };
}

function balance(feeEntries, payments = [], options = {}) {
  return calculateStudentBalance({
    studentId: 'student-1',
    feeEntries,
    payments,
    termCalendar: options.termCalendar ?? TERMS,
    asOfDate: options.asOfDate ?? AS_OF,
    currentTermId: options.currentTermId,
  });
}

function expectMoney(actual, expected) {
  assert.equal(actual.toFixed(2), money(expected).toFixed(2));
}

describe('SchoolPass Phase 1: dynamic ledger balance calculation', () => {
  it('computes charges minus offline payments minus online payments', () => {
    const result = balance(
      [
        entry('2026/2027-T1', 'CHARGE', '40000.00'),
        entry('2026/2027-T2', 'CHARGE', '80000.00'),
        entry('2026/2027-T1', 'OFFLINE_PAYMENT', '15000.00'),
      ],
      [payment('25000.00')]
    );

    expectMoney(result.totalCharges, '120000.00');
    expectMoney(result.totalOfflinePayments, '15000.00');
    expectMoney(result.totalOnlinePayments, '25000.00');
    expectMoney(result.totalPaid, '40000.00');
    expectMoney(result.totalOutstanding, '80000.00');
    expectMoney(result.amountDue, '80000.00');
    expectMoney(result.creditBalance, ZERO);
  });

  it('handles a normal full payment with no balance remaining', () => {
    const result = balance(
      [entry('2026/2027-T1', 'CHARGE', '50000.00')],
      [payment('50000.00')]
    );

    expectMoney(result.totalOutstanding, ZERO);
    expectMoney(result.earlierTermsArrears, ZERO);
    expectMoney(result.currentTermBalance, ZERO);
    expectMoney(result.unallocatedPayment, ZERO);
  });

  it('handles partial payments and reports the remainder due', () => {
    const result = balance(
      [entry('2026/2027-T2', 'CHARGE', '100000.00')],
      [payment('35000.00')]
    );

    expectMoney(result.totalOutstanding, '65000.00');
    expectMoney(result.termBreakdown[0].paid, '35000.00');
    expectMoney(result.termBreakdown[0].outstanding, '65000.00');
  });

  it('settles previous-term arrears before newer charges using FIFO', () => {
    const result = balance(
      [
        entry('2026/2027-T1', 'CHARGE', '40000.00'),
        entry('2026/2027-T2', 'CHARGE', '80000.00'),
      ],
      [payment('30000.00')]
    );

    assert.equal(result.termBreakdown.length, 2);
    expectMoney(result.termBreakdown[0].paid, '30000.00');
    expectMoney(result.termBreakdown[0].outstanding, '10000.00');
    expectMoney(result.termBreakdown[1].paid, ZERO);
    expectMoney(result.termBreakdown[1].outstanding, '80000.00');
    expectMoney(result.earlierTermsArrears, '10000.00');
    expectMoney(result.currentTermBalance, '80000.00');
    expectMoney(result.totalOutstanding, '90000.00');
  });

  it('cascades payments through multiple earlier terms before the current term', () => {
    const result = balance(
      [
        entry('2026/2027-T1', 'CHARGE', '10000.00'),
        entry('2026/2027-T2', 'CHARGE', '20000.00'),
        entry('2026/2027-T3', 'CHARGE', '30000.00'),
      ],
      [payment('25000.00')],
      { asOfDate: new Date('2027-05-01T00:00:00.000Z'), currentTermId: '2026/2027-T3' }
    );

    expectMoney(result.termBreakdown[0].outstanding, ZERO);
    expectMoney(result.termBreakdown[1].outstanding, '5000.00');
    expectMoney(result.termBreakdown[2].outstanding, '30000.00');
    expectMoney(result.earlierTermsArrears, '5000.00');
    expectMoney(result.currentTermBalance, '30000.00');
  });

  it('excludes charges for terms that have not started', () => {
    const result = balance([
      entry('2026/2027-T1', 'CHARGE', '40000.00'),
      entry('2026/2027-T3', 'CHARGE', '70000.00'),
    ]);

    expectMoney(result.totalCharges, '40000.00');
    expectMoney(result.totalOutstanding, '40000.00');
    assert.deepEqual(
      result.termBreakdown.map((term) => term.termId),
      ['2026/2027-T1', '2026/2027-T2']
    );
  });

  it('uses asOfDate to exclude a term that starts later', () => {
    const result = balance(
      [
        entry('2026/2027-T1', 'CHARGE', '40000.00'),
        entry('2026/2027-T2', 'CHARGE', '80000.00'),
      ],
      [],
      { asOfDate: new Date('2026-12-01T00:00:00.000Z') }
    );

    expectMoney(result.totalCharges, '40000.00');
    expectMoney(result.totalOutstanding, '40000.00');
    assert.equal(result.currentTermId, '2026/2027-T1');
  });

  it('reduces the balance with a negative adjustment', () => {
    const result = balance([
      entry('2026/2027-T2', 'CHARGE', '100000.00'),
      entry('2026/2027-T2', 'ADJUSTMENT', '-15000.00'),
    ]);

    expectMoney(result.totalCharges, '85000.00');
    expectMoney(result.totalOutstanding, '85000.00');
    expectMoney(result.termBreakdown[0].adjustments, '-15000.00');
    expectMoney(result.termBreakdown[0].charges, '85000.00');
  });

  it('increases the balance with a positive adjustment', () => {
    const result = balance([
      entry('2026/2027-T2', 'CHARGE', '100000.00'),
      entry('2026/2027-T2', 'ADJUSTMENT', '5000.00'),
    ]);

    expectMoney(result.totalCharges, '105000.00');
    expectMoney(result.totalOutstanding, '105000.00');
  });

  it('carries a signed adjustment credit without breaking term totals', () => {
    const result = balance([
      entry('2026/2027-T1', 'CHARGE', '100000.00'),
      entry('2026/2027-T2', 'ADJUSTMENT', '-50000.00'),
    ]);

    expectMoney(result.totalCharges, '50000.00');
    expectMoney(result.totalOutstanding, '50000.00');
    expectMoney(result.termBreakdown[0].outstanding, '100000.00');
    expectMoney(result.termBreakdown[1].outstanding, '-50000.00');
    expectMoney(result.earlierTermsArrears, '100000.00');
    expectMoney(result.currentTermBalance, '-50000.00');
  });

  it('combines offline and online payments and ignores pending or failed online payments', () => {
    const result = balance(
      [
        entry('2026/2027-T2', 'CHARGE', '100000.00'),
        entry('2026/2027-T1', 'OFFLINE_PAYMENT', '10000.00'),
      ],
      [payment('20000.00', 'SUCCESSFUL'), payment('30000.00', 'PENDING'), payment('40000.00', 'FAILED')]
    );

    expectMoney(result.totalOfflinePayments, '10000.00');
    expectMoney(result.totalOnlinePayments, '20000.00');
    expectMoney(result.totalPaid, '30000.00');
    expectMoney(result.totalOutstanding, '70000.00');
  });

  it('increases the balance by the amount of confirmed partial refunds', () => {
    const result = balance(
      [entry('2026/2027-T2', 'CHARGE', '100000.00')],
      [payment('100000.00', 'SUCCESSFUL', [refund('25000.00', 'CONFIRMED')])]
    );

    expectMoney(result.totalOnlinePayments, '75000.00');
    expectMoney(result.totalRefunds, '25000.00');
    expectMoney(result.totalOutstanding, '25000.00');
  });

  it('ignores pending refunds', () => {
    const result = balance(
      [entry('2026/2027-T2', 'CHARGE', '100000.00')],
      [payment('100000.00', 'SUCCESSFUL', [refund('25000.00', 'PENDING')])]
    );

    expectMoney(result.totalRefunds, ZERO);
    expectMoney(result.totalOutstanding, ZERO);
  });

  it('nets a fully refunded payment to zero', () => {
    const result = balance(
      [entry('2026/2027-T2', 'CHARGE', '100000.00')],
      [payment('100000.00', 'REFUNDED', [refund('100000.00', 'CONFIRMED')])]
    );

    expectMoney(result.totalOnlinePayments, ZERO);
    expectMoney(result.totalOutstanding, '100000.00');
  });

  it('sums confirmed refunds across multiple payments', () => {
    const result = balance(
      [entry('2026/2027-T2', 'CHARGE', '100000.00')],
      [
        payment('40000.00', 'SUCCESSFUL', [refund('10000.00')]),
        payment('60000.00', 'SUCCESSFUL', [refund('5000.00', 'PENDING'), refund('5000.00')]),
      ]
    );

    expectMoney(result.totalOnlinePayments, '85000.00');
    expectMoney(result.totalRefunds, '15000.00');
    expectMoney(result.totalOutstanding, '15000.00');
  });

  it('records overpayment as credit and unallocated payment', () => {
    const result = balance(
      [entry('2026/2027-T2', 'CHARGE', '100000.00')],
      [payment('150000.00')]
    );

    expectMoney(result.totalOutstanding, '-50000.00');
    expectMoney(result.amountDue, ZERO);
    expectMoney(result.creditBalance, '50000.00');
    expectMoney(result.unallocatedPayment, '50000.00');
    expectMoney(result.termBreakdown[0].paid, '100000.00');
    expectMoney(result.termBreakdown[0].outstanding, ZERO);
  });

  it('returns a zero summary when there are no fee entries or payments', () => {
    const result = balance([], [], { asOfDate: new Date('2026-01-01T00:00:00.000Z') });

    expectMoney(result.totalCharges, ZERO);
    expectMoney(result.totalPaid, ZERO);
    expectMoney(result.totalOutstanding, ZERO);
    expectMoney(result.earlierTermsArrears, ZERO);
    expectMoney(result.currentTermBalance, ZERO);
    assert.equal(result.currentTermId, null);
    assert.deepEqual(result.termBreakdown, []);
  });

  it('counts offline payments even when tagged to a future term', () => {
    const result = balance([
      entry('2026/2027-T1', 'CHARGE', '40000.00'),
      entry('2026/2027-T3', 'CHARGE', '70000.00'),
      entry('2026/2027-T3', 'OFFLINE_PAYMENT', '10000.00'),
    ]);

    expectMoney(result.totalOfflinePayments, '10000.00');
    expectMoney(result.totalOutstanding, '30000.00');
  });

  it('orders terms chronologically and breaks ties by termId', () => {
    const result = calculateStudentBalance({
      studentId: 'student-1',
      feeEntries: [
        entry('2026/2027-T2', 'CHARGE', '20000.00'),
        entry('2026/2027-T1', 'CHARGE', '10000.00'),
      ],
      termCalendar: [
        { termId: '2026/2027-T2', startDate: '2026-09-01T00:00:00.000Z' },
        { termId: '2026/2027-T1', startDate: '2026-09-01T00:00:00.000Z' },
      ],
      asOfDate: AS_OF,
    });

    assert.deepEqual(
      result.termBreakdown.map((term) => term.termId),
      ['2026/2027-T1', '2026/2027-T2']
    );
  });

  it('honours an explicit current term when identifying arrears', () => {
    const result = balance(
      [
        entry('2026/2027-T1', 'CHARGE', '10000.00'),
        entry('2026/2027-T2', 'CHARGE', '20000.00'),
        entry('2026/2027-T3', 'CHARGE', '30000.00'),
      ],
      [],
      { asOfDate: new Date('2027-05-01T00:00:00.000Z'), currentTermId: '2026/2027-T2' }
    );

    expectMoney(result.earlierTermsArrears, '10000.00');
    expectMoney(result.currentTermBalance, '20000.00');
    assert.equal(result.termBreakdown[1].isCurrentTerm, true);
  });

  it('preserves two-decimal precision', () => {
    const result = balance(
      [
        entry('2026/2027-T2', 'CHARGE', '100000.01'),
        entry('2026/2027-T2', 'ADJUSTMENT', '-0.01'),
      ],
      [payment('33333.33')]
    );

    expectMoney(result.totalCharges, '100000.00');
    expectMoney(result.totalOutstanding, '66666.67');
  });

  it('keeps totalOutstanding equal to totalCharges minus totalPaid', () => {
    const result = balance(
      [
        entry('2026/2027-T1', 'CHARGE', '10000.00'),
        entry('2026/2027-T2', 'CHARGE', '20000.00'),
        entry('2026/2027-T2', 'ADJUSTMENT', '-5000.00'),
        entry('2026/2027-T1', 'OFFLINE_PAYMENT', '25000.00'),
      ],
      [payment('15000.00')]
    );

    expectMoney(result.totalOutstanding, result.totalCharges.minus(result.totalPaid));
    expectMoney(result.totalCharges, '25000.00');
    expectMoney(result.totalPaid, '40000.00');
    expectMoney(result.creditBalance, '15000.00');
  });

  it('rejects an explicit current term that is not configured', () => {
    assert.throws(
      () => balance([], [], { currentTermId: '2099/2100-T1' }),
      (error) => error instanceof LedgerConfigurationError
    );
  });

  it('rejects a current term that has not started', () => {
    assert.throws(
      () => balance([], [], { currentTermId: '2026/2027-T3' }),
      (error) => error instanceof LedgerConfigurationError
    );
  });

  it('rejects unsupported payment and refund statuses', () => {
    assert.throws(
      () =>
        balance(
          [entry('2026/2027-T2', 'CHARGE', '1000.00')],
          [payment('1000.00', 'COMPLETED')]
        ),
      (error) => error instanceof LedgerValidationError
    );
    assert.throws(
      () =>
        balance(
          [entry('2026/2027-T2', 'CHARGE', '1000.00')],
          [payment('1000.00', 'SUCCESSFUL', [refund('100.00', 'APPROVED')])]
        ),
      (error) => error instanceof LedgerValidationError
    );
  });

  it('rejects zero offline payment amounts', () => {
    assert.throws(
      () => balance([entry('2026/2027-T1', 'OFFLINE_PAYMENT', '0.00')]),
      (error) => error instanceof LedgerValidationError
    );
  });

  it('rejects fee entries for terms missing from the term calendar', () => {
    assert.throws(
      () => balance([entry('2099/2100-T1', 'CHARGE', '1000.00')]),
      (error) =>
        error instanceof LedgerConfigurationError &&
        error.message.includes('2099/2100-T1')
    );
  });

  it('rejects duplicate term definitions', () => {
    assert.throws(
      () =>
        balance([entry('2026/2027-T1', 'CHARGE', '1000.00')], [], {
          termCalendar: [
            { termId: '2026/2027-T1', startDate: '2026-09-01T00:00:00.000Z' },
            { termId: '2026/2027-T1', startDate: '2026-10-01T00:00:00.000Z' },
          ],
        }),
      (error) => error instanceof LedgerConfigurationError
    );
  });

  it('rejects invalid charge amounts', () => {
    assert.throws(
      () => balance([entry('2026/2027-T1', 'CHARGE', '0.00')]),
      (error) => error instanceof LedgerValidationError
    );
    assert.throws(
      () => balance([entry('2026/2027-T1', 'CHARGE', '-100.00')]),
      (error) => error instanceof LedgerValidationError
    );
  });

  it('rejects zero adjustments', () => {
    assert.throws(
      () => balance([entry('2026/2027-T1', 'ADJUSTMENT', '0.00')]),
      (error) => error instanceof LedgerValidationError
    );
  });

  it('rejects confirmed refunds greater than the original payment', () => {
    assert.throws(
      () =>
        balance(
          [entry('2026/2027-T2', 'CHARGE', '100000.00')],
          [payment('10000.00', 'SUCCESSFUL', [refund('10001.00')])]
        ),
      (error) => error instanceof LedgerValidationError
    );
  });

  it('rejects records that belong to another student', () => {
    assert.throws(
      () =>
        balance([entry('2026/2027-T1', 'CHARGE', '1000.00', { studentId: 'student-2' })]),
      (error) => error instanceof LedgerValidationError
    );
    assert.throws(
      () =>
        balance(
          [entry('2026/2027-T1', 'CHARGE', '1000.00')],
          [payment('1000.00', 'SUCCESSFUL', [], { studentId: 'student-2' })]
        ),
      (error) => error instanceof LedgerValidationError
    );
  });
});

describe('SchoolPass Phase 1: payment amount validation', () => {
  it('accepts a positive amount within the outstanding balance', () => {
    const summary = balance([entry('2026/2027-T2', 'CHARGE', '100000.00')]);
    assert.deepEqual(validatePaymentAmountAgainstBalance('50000.00', summary), { valid: true });
  });

  it('rejects zero and negative amounts', () => {
    const summary = balance([entry('2026/2027-T2', 'CHARGE', '100000.00')]);
    assert.equal(validatePaymentAmountAgainstBalance('0.00', summary).valid, false);
    assert.equal(validatePaymentAmountAgainstBalance('-1.00', summary).valid, false);
  });

  it('rejects amounts above the outstanding balance by default', () => {
    const summary = balance([entry('2026/2027-T2', 'CHARGE', '100000.00')]);
    const result = validatePaymentAmountAgainstBalance('100000.01', summary);
    assert.equal(result.valid, false);
    assert.equal(result.error, 'Payment amount cannot exceed the outstanding balance.');
  });

  it('rejects payments when there is no outstanding balance', () => {
    const summary = balance([entry('2026/2027-T2', 'CHARGE', '100000.00')], [payment('100000.00')]);
    const result = validatePaymentAmountAgainstBalance('1000.00', summary);
    assert.equal(result.valid, false);
    assert.equal(result.error, 'This student has no outstanding balance.');
  });

  it('enforces a configured minimum amount', () => {
    const summary = balance([entry('2026/2027-T2', 'CHARGE', '100000.00')]);
    const result = validatePaymentAmountAgainstBalance('999.99', summary, {
      minimumAmount: '1000.00',
    });
    assert.equal(result.valid, false);
    assert.equal(result.error, 'Payment amount is below the minimum allowed amount.');
  });

  it('allows overpayment only when explicitly enabled', () => {
    const summary = balance([entry('2026/2027-T2', 'CHARGE', '100000.00')]);
    const result = validatePaymentAmountAgainstBalance('150000.00', summary, {
      allowOverpayment: true,
    });
    assert.deepEqual(result, { valid: true });
  });
});

describe('SchoolPass Phase 1: term calendar parsing', () => {
  it('parses an array of terms', () => {
    const calendar = parseTermCalendarValue(JSON.stringify(TERMS));
    assert.equal(calendar.terms.length, 3);
    assert.equal(calendar.terms[0].termId, '2026/2027-T1');
  });

  it('parses a calendar object with a current term', () => {
    const calendar = parseTermCalendarValue(
      JSON.stringify({ currentTermId: '2026/2027-T2', terms: TERMS })
    );
    assert.equal(calendar.currentTermId, '2026/2027-T2');
    assert.equal(calendar.terms.length, 3);
  });

  it('parses a termId-to-date mapping', () => {
    const calendar = parseTermCalendarValue(
      JSON.stringify({
        '2026/2027-T1': '2026-09-01T00:00:00.000Z',
        '2026/2027-T2': { startDate: '2027-01-10T00:00:00.000Z', name: 'Second Term' },
      })
    );
    assert.equal(calendar.terms.length, 2);
    assert.equal(calendar.terms[1].name, 'Second Term');
  });

  it('rejects invalid JSON', () => {
    assert.throws(
      () => parseTermCalendarValue('{not json'),
      (error) => error instanceof LedgerConfigurationError
    );
  });
});

describe('SchoolPass Phase 1: financial deletion safeguards', () => {
  it('allows deletion when the student has no financial records', () => {
    assert.deepEqual(evaluateDeletionGuard('student', { feeEntries: 0, payments: 0 }), {
      allowed: true,
    });
  });

  it('blocks student deletion when fee entries exist', () => {
    const result = evaluateDeletionGuard('student', { feeEntries: 1, payments: 0 });
    assert.equal(result.allowed, false);
    assert.equal(result.code, 'FINANCIAL_RECORDS_EXIST');
    assert.match(result.error, /Student must be marked as left \(leftAt\)/);
  });

  it('blocks student deletion when payments exist', () => {
    const result = evaluateDeletionGuard('student', { feeEntries: 0, payments: 1 });
    assert.equal(result.allowed, false);
    assert.equal(result.code, 'FINANCIAL_RECORDS_EXIST');
  });

  it('blocks parent deletion when payment records exist', () => {
    const result = evaluateDeletionGuard('parent', { feeEntries: 0, payments: 1 });
    assert.equal(result.allowed, false);
    assert.equal(result.code, 'FINANCIAL_RECORDS_EXIST');
    assert.match(result.error, /Parent account must be retained/);
  });

  it('rejects invalid financial record counts', () => {
    assert.throws(
      () => evaluateDeletionGuard('student', { feeEntries: -1, payments: 0 }),
      (error) => error instanceof LedgerValidationError
    );
    assert.throws(
      () => evaluateDeletionGuard('student', { feeEntries: 1.5, payments: 0 }),
      (error) => error instanceof LedgerValidationError
    );
  });
});
