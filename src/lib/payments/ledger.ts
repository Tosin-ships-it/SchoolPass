import 'server-only';
import { Prisma } from '@prisma/client';
import {
  LEDGER_ALLOCATION_METHOD,
  type CalculateStudentBalanceInput,
  type ComputeStudentBalanceOptions,
  type DeletionEntityKind,
  type DeletionGuardResult,
  type FeeEntryTypeValue,
  type FinancialRecordFootprint,
  type LedgerFeeEntry,
  type LedgerPayment,
  type Money,
  type MoneyInput,
  type PaymentAmountValidationOptions,
  type PaymentAmountValidationResult,
  type RefundStatusValue,
  type StudentBalanceSummary,
  type TermBalance,
  type TermBreakdown,
  type TermCalendar,
  type TermCalendarInput,
  type TermDefinition,
} from './types';

export class LedgerValidationError extends Error {
  readonly code = 'LEDGER_VALIDATION_ERROR';

  constructor(message: string) {
    super(message);
    this.name = 'LedgerValidationError';
  }
}

export class LedgerConfigurationError extends Error {
  readonly code = 'LEDGER_CONFIGURATION_ERROR';

  constructor(message: string) {
    super(message);
    this.name = 'LedgerConfigurationError';
  }
}

interface NormalizedTerm {
  termId: string;
  name: string;
  startDate: Date;
}

interface NormalizedCalendar {
  terms: Map<string, NormalizedTerm>;
  currentTermId: string | null;
}

interface TermChargeTotals {
  termId: string;
  grossCharges: Money;
  adjustments: Money;
}

const ZERO = new Prisma.Decimal(0);

function decimal(value: MoneyInput, fieldName: string): Money {
  try {
    const parsed = value instanceof Prisma.Decimal ? value : new Prisma.Decimal(value);
    if (!parsed.isFinite()) {
      throw new Error('not finite');
    }
    return parsed;
  } catch {
    throw new LedgerValidationError(`${fieldName} is not a valid monetary amount.`);
  }
}

function positiveDecimal(value: MoneyInput, fieldName: string): Money {
  const parsed = decimal(value, fieldName);
  if (parsed.lessThanOrEqualTo(0)) {
    throw new LedgerValidationError(`${fieldName} must be greater than zero.`);
  }
  return parsed;
}

function nonZeroDecimal(value: MoneyInput, fieldName: string): Money {
  const parsed = decimal(value, fieldName);
  if (parsed.isZero()) {
    throw new LedgerValidationError(`${fieldName} must not be zero.`);
  }
  return parsed;
}

function validDate(value: Date | string, fieldName: string): Date {
  if (value === null || value === undefined || (typeof value === 'string' && value.trim() === '')) {
    throw new LedgerConfigurationError(`${fieldName} is not a valid date.`);
  }
  const parsed = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new LedgerConfigurationError(`${fieldName} is not a valid date.`);
  }
  return parsed;
}

function isTermCalendar(input: TermCalendarInput): input is TermCalendar {
  return (
    typeof input === 'object' &&
    input !== null &&
    !Array.isArray(input) &&
    'terms' in input &&
    Array.isArray((input as TermCalendar).terms)
  );
}

function normalizeTermCalendar(input: TermCalendarInput): NormalizedCalendar {
  const definitions: TermDefinition[] = [];
  let currentTermId: string | null = null;

  if (Array.isArray(input)) {
    definitions.push(...(input as readonly TermDefinition[]));
  } else if (isTermCalendar(input)) {
    definitions.push(...input.terms);
    currentTermId = input.currentTermId ?? null;
  } else {
    for (const [termId, raw] of Object.entries(input)) {
      if (typeof raw === 'object' && raw !== null && 'startDate' in raw) {
        definitions.push({ termId, startDate: raw.startDate, name: raw.name });
      } else {
        definitions.push({ termId, startDate: raw as Date | string });
      }
    }
  }

  const terms = new Map<string, NormalizedTerm>();
  for (const definition of definitions) {
    const termId = definition.termId?.trim();
    if (!termId) {
      throw new LedgerConfigurationError('Every configured term must have a termId.');
    }
    if (terms.has(termId)) {
      throw new LedgerConfigurationError(`Term ${termId} is configured more than once.`);
    }
    terms.set(termId, {
      termId,
      name: definition.name?.trim() || termId,
      startDate: validDate(definition.startDate, `Start date for term ${termId}`),
    });
  }

  if (currentTermId !== null && !terms.has(currentTermId)) {
    throw new LedgerConfigurationError(
      `The configured current term ${currentTermId} is not present in the term calendar.`
    );
  }

  return { terms, currentTermId };
}

function toTermCalendar(calendar: NormalizedCalendar): TermCalendar {
  return {
    currentTermId: calendar.currentTermId,
    terms: Array.from(calendar.terms.values()).map((term) => ({
      termId: term.termId,
      name: term.name,
      startDate: term.startDate,
    })),
  };
}

export function parseTermCalendarValue(value: string): TermCalendar {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new LedgerConfigurationError('The configured term calendar is not valid JSON.');
  }

  if (Array.isArray(parsed)) {
    return toTermCalendar(normalizeTermCalendar(parsed as readonly TermDefinition[]));
  }

  if (typeof parsed === 'object' && parsed !== null && 'terms' in parsed) {
    const calendar = parsed as TermCalendar;
    return toTermCalendar(normalizeTermCalendar(calendar));
  }

  if (typeof parsed === 'object' && parsed !== null) {
    return toTermCalendar(
      normalizeTermCalendar(parsed as Readonly<Record<string, Date | string | { startDate: Date | string; name?: string }>>)
    );
  }

  throw new LedgerConfigurationError('The configured term calendar has an unsupported shape.');
}

function assertEntryBelongsToStudent(entry: LedgerFeeEntry, studentId: string): void {
  if (entry.studentId !== undefined && entry.studentId !== studentId) {
    throw new LedgerValidationError('A fee entry does not belong to the requested student.');
  }
}

function assertPaymentBelongsToStudent(payment: LedgerPayment, studentId: string): void {
  if (payment.studentId !== undefined && payment.studentId !== studentId) {
    throw new LedgerValidationError('A payment does not belong to the requested student.');
  }
}

function confirmedRefundTotal(payment: LedgerPayment): Money {
  const paymentAmount = positiveDecimal(payment.amount, 'Payment amount');
  let total = ZERO;

  for (const refund of payment.refunds ?? []) {
    const status = refund.status as RefundStatusValue;
    if (status !== 'PENDING' && status !== 'CONFIRMED') {
      throw new LedgerValidationError('A refund has an unsupported status.');
    }
    if (status === 'PENDING') {
      continue;
    }
    total = total.plus(positiveDecimal(refund.amount, 'Refund amount'));
  }

  if (total.greaterThan(paymentAmount)) {
    throw new LedgerValidationError('Confirmed refunds cannot exceed the original payment amount.');
  }

  return total;
}

function moneyMax(value: Money, floor: Money): Money {
  return value.lessThan(floor) ? floor : value;
}

function moneyMin(value: Money, ceiling: Money): Money {
  return value.greaterThan(ceiling) ? ceiling : value;
}

function sumMoney(values: readonly Money[]): Money {
  return values.reduce((total, value) => total.plus(value), ZERO);
}

export function calculateStudentBalance(input: CalculateStudentBalanceInput): StudentBalanceSummary {
  const asOfDate = input.asOfDate ? validDate(input.asOfDate, 'asOfDate') : new Date();
  const calendar = normalizeTermCalendar(input.termCalendar);

  const termTotals = new Map<string, TermChargeTotals>();
  let totalOfflinePayments = ZERO;

  for (const entry of input.feeEntries) {
    assertEntryBelongsToStudent(entry, input.studentId);
    const type = entry.type as FeeEntryTypeValue;

    if (type === 'OFFLINE_PAYMENT') {
      totalOfflinePayments = totalOfflinePayments.plus(
        positiveDecimal(entry.amount, 'Offline payment amount')
      );
      continue;
    }

    if (type !== 'CHARGE' && type !== 'ADJUSTMENT') {
      throw new LedgerValidationError('A fee entry has an unsupported type.');
    }

    if (!calendar.terms.has(entry.termId)) {
      throw new LedgerConfigurationError(
        `Fee entry references term ${entry.termId}, which is not configured in the term calendar.`
      );
    }

    const amount =
      type === 'CHARGE'
        ? positiveDecimal(entry.amount, 'Charge amount')
        : nonZeroDecimal(entry.amount, 'Adjustment amount');

    const current = termTotals.get(entry.termId) ?? {
      termId: entry.termId,
      grossCharges: ZERO,
      adjustments: ZERO,
    };

    if (type === 'CHARGE') {
      current.grossCharges = current.grossCharges.plus(amount);
    } else {
      current.adjustments = current.adjustments.plus(amount);
    }

    termTotals.set(entry.termId, current);
  }

  const totalOnlinePayments = sumEligibleOnlinePayments(input.payments ?? [], input.studentId);
  const totalPaid = totalOfflinePayments.plus(totalOnlinePayments.onlinePayments);

  const startedTermIds = new Set<string>();
  for (const term of calendar.terms.values()) {
    if (term.startDate.getTime() <= asOfDate.getTime()) {
      startedTermIds.add(term.termId);
    }
  }

  const explicitCurrentTermId =
    input.currentTermId !== undefined ? input.currentTermId : calendar.currentTermId;
  if (explicitCurrentTermId !== null) {
    const currentTerm = calendar.terms.get(explicitCurrentTermId);
    if (!currentTerm) {
      throw new LedgerConfigurationError(
        `The current term ${explicitCurrentTermId} is not configured in the term calendar.`
      );
    }
    if (currentTerm.startDate.getTime() > asOfDate.getTime()) {
      throw new LedgerConfigurationError('The configured current term has not started yet.');
    }
  }

  const startedTerms = Array.from(calendar.terms.values())
    .filter((term) => startedTermIds.has(term.termId))
    .sort((a, b) => a.startDate.getTime() - b.startDate.getTime() || a.termId.localeCompare(b.termId));

  let currentTermId = explicitCurrentTermId;
  if (currentTermId === null && startedTerms.length > 0) {
    currentTermId = startedTerms[startedTerms.length - 1].termId;
  }

  const displayedTerms = startedTerms.filter(
    (term) => termTotals.has(term.termId) || term.termId === currentTermId
  );

  let remainingPayment = totalPaid;
  const termBreakdown: TermBalance[] = displayedTerms.map((term) => {
    const totals = termTotals.get(term.termId) ?? {
      termId: term.termId,
      grossCharges: ZERO,
      adjustments: ZERO,
    };
    const netCharges = totals.grossCharges.plus(totals.adjustments);
    const allocated = netCharges.greaterThan(0) ? moneyMin(remainingPayment, netCharges) : ZERO;
    remainingPayment = remainingPayment.minus(allocated);

    return {
      termId: term.termId,
      termName: term.name,
      startDate: term.startDate,
      charges: netCharges,
      grossCharges: totals.grossCharges,
      adjustments: totals.adjustments,
      paid: allocated,
      outstanding: netCharges.minus(allocated),
      isCurrentTerm: term.termId === currentTermId,
      allocationMethod: LEDGER_ALLOCATION_METHOD,
    };
  });

  const totalCharges = sumMoney(termBreakdown.map((term) => term.charges));
  const totalOutstanding = totalCharges.minus(totalPaid);
  const currentTermIndex = termBreakdown.findIndex((term) => term.isCurrentTerm);

  const earlierTermsArrears = sumMoney(
    termBreakdown
      .filter((_, index) => currentTermIndex === -1 || index < currentTermIndex)
      .map((term) => term.outstanding)
  );
  const currentTermBalance =
    currentTermIndex === -1 ? ZERO : termBreakdown[currentTermIndex].outstanding;

  return {
    studentId: input.studentId,
    asOfDate,
    totalOutstanding,
    amountDue: moneyMax(totalOutstanding, ZERO),
    creditBalance: moneyMax(totalOutstanding.negated(), ZERO),
    earlierTermsArrears,
    currentTermBalance,
    totalCharges,
    totalPaid,
    totalOfflinePayments,
    totalOnlinePayments: totalOnlinePayments.onlinePayments,
    totalRefunds: totalOnlinePayments.refunds,
    unallocatedPayment: remainingPayment,
    currentTermId,
    allocationMethod: LEDGER_ALLOCATION_METHOD,
    termBreakdown,
  };
}

function sumEligibleOnlinePayments(
  payments: readonly LedgerPayment[],
  studentId: string
): { onlinePayments: Money; refunds: Money } {
  let onlinePayments = ZERO;
  let refunds = ZERO;

  for (const payment of payments) {
    assertPaymentBelongsToStudent(payment, studentId);

    if (payment.status === 'PENDING' || payment.status === 'FAILED') {
      continue;
    }
    if (payment.status !== 'SUCCESSFUL' && payment.status !== 'REFUNDED') {
      throw new LedgerValidationError('A payment has an unsupported status.');
    }

    const amount = positiveDecimal(payment.amount, 'Payment amount');
    const confirmedRefunds = confirmedRefundTotal(payment);

    onlinePayments = onlinePayments.plus(amount.minus(confirmedRefunds));
    refunds = refunds.plus(confirmedRefunds);
  }

  return { onlinePayments, refunds };
}

async function loadFeeEntries(studentId: string): Promise<LedgerFeeEntry[]> {
  const { prisma } = await import('@/lib/db');
  return prisma.feeEntry.findMany({
    where: { studentId },
    select: {
      id: true,
      studentId: true,
      termId: true,
      type: true,
      amount: true,
      note: true,
      createdAt: true,
    },
  });
}

async function loadPayments(studentId: string): Promise<LedgerPayment[]> {
  const { prisma } = await import('@/lib/db');
  const payments = await prisma.payment.findMany({
    where: { studentId },
    select: {
      id: true,
      studentId: true,
      amount: true,
      status: true,
      createdAt: true,
      verifiedAt: true,
      refunds: {
        select: {
          id: true,
          paymentId: true,
          amount: true,
          status: true,
          createdAt: true,
        },
      },
    },
  });
  return payments;
}

export async function loadTermCalendarFromSettings(options?: {
  prismaClient?: any;
}): Promise<TermCalendar | null> {
  try {
    const db = options?.prismaClient ?? (await import('@/lib/db')).prisma;
    const rows = await db.schoolSetting.findMany({
      where: { key: { in: ['academic_terms', 'term_calendar'] } },
      select: { key: true, value: true },
    });

    for (const key of ['academic_terms', 'term_calendar']) {
      const row = rows.find((candidate) => candidate.key === key);
      if (row) {
        try {
          const raw = JSON.parse(row.value);
          // Check if raw stored calendar has terms
          if (raw && typeof raw === 'object' && Array.isArray(raw.terms)) {
            // Identify the current term to check
            const currentTermId = raw.currentTermId || raw.terms[0]?.termId;
            const currentTerm = raw.terms.find((t: any) => t.termId === currentTermId);

            // Require the necessary valid date range for the selected current term before enabling financial operations
            if (
              !currentTerm ||
              !currentTerm.startDate ||
              !currentTerm.endDate ||
              Number.isNaN(new Date(currentTerm.startDate).getTime()) ||
              Number.isNaN(new Date(currentTerm.endDate).getTime()) ||
              new Date(currentTerm.startDate).getTime() >= new Date(currentTerm.endDate).getTime()
            ) {
              return null;
            }

            // Filter out future terms that have missing dates so parseTermCalendarValue receives valid term definitions
            const validTerms = raw.terms.filter(
              (t: any) => t.startDate && !Number.isNaN(new Date(t.startDate).getTime())
            );

            return parseTermCalendarValue(
              JSON.stringify({
                currentTermId: raw.currentTermId,
                terms: validTerms,
              })
            );
          }
          return parseTermCalendarValue(row.value);
        } catch {
          return null;
        }
      }
    }

    return null;
  } catch {
    return null;
  }
}

export async function computeStudentBalance(
  studentId: string,
  asOfDate?: Date,
  options?: ComputeStudentBalanceOptions
): Promise<StudentBalanceSummary> {
  const [feeEntries, payments, configuredCalendar] = await Promise.all([
    loadFeeEntries(studentId),
    loadPayments(studentId),
    options?.termCalendar ? Promise.resolve(null) : loadTermCalendarFromSettings(),
  ]);

  const termCalendar = options?.termCalendar ?? configuredCalendar;
  if (!termCalendar) {
    throw new LedgerConfigurationError(
      'The academic term calendar is not configured. Configure the academic_terms school setting before calculating balances.'
    );
  }

  return calculateStudentBalance({
    studentId,
    feeEntries,
    payments,
    termCalendar,
    asOfDate,
    currentTermId: options?.currentTermId,
  });
}

export async function getTermFeeBreakdown(
  studentId: string,
  asOfDate?: Date,
  options?: ComputeStudentBalanceOptions
): Promise<TermBreakdown> {
  const summary = await computeStudentBalance(studentId, asOfDate, options);
  return {
    currentTermId: summary.currentTermId,
    allocationMethod: summary.allocationMethod,
    terms: summary.termBreakdown,
  };
}

export function validatePaymentAmountAgainstBalance(
  amount: MoneyInput,
  balance: StudentBalanceSummary,
  options: PaymentAmountValidationOptions = {}
): PaymentAmountValidationResult {
  const parsedAmount = decimal(amount, 'Payment amount');
  if (parsedAmount.lessThanOrEqualTo(0)) {
    return { valid: false, error: 'Payment amount must be greater than zero.' };
  }

  if (options.minimumAmount !== undefined) {
    const minimum = decimal(options.minimumAmount, 'Minimum payment amount');
    if (parsedAmount.lessThan(minimum)) {
      return { valid: false, error: 'Payment amount is below the minimum allowed amount.' };
    }
  }

  if (options.allowOverpayment !== true) {
    if (balance.amountDue.lessThanOrEqualTo(0)) {
      return { valid: false, error: 'This student has no outstanding balance.' };
    }
    if (parsedAmount.greaterThan(balance.amountDue)) {
      return { valid: false, error: 'Payment amount cannot exceed the outstanding balance.' };
    }
  }

  return { valid: true };
}

export async function validatePaymentAmount(
  studentId: string,
  amount: MoneyInput,
  asOfDate?: Date,
  options?: ComputeStudentBalanceOptions & PaymentAmountValidationOptions
): Promise<PaymentAmountValidationResult> {
  const parsedAmount = decimal(amount, 'Payment amount');
  if (parsedAmount.lessThanOrEqualTo(0)) {
    return { valid: false, error: 'Payment amount must be greater than zero.' };
  }

  const balance = await computeStudentBalance(studentId, asOfDate, options);
  return validatePaymentAmountAgainstBalance(parsedAmount, balance, options);
}

export function evaluateDeletionGuard(
  entityKind: DeletionEntityKind,
  footprint: FinancialRecordFootprint
): DeletionGuardResult {
  if (
    !Number.isInteger(footprint.feeEntries) ||
    footprint.feeEntries < 0 ||
    !Number.isInteger(footprint.payments) ||
    footprint.payments < 0
  ) {
    throw new LedgerValidationError('Financial record counts must be non-negative integers.');
  }

  if (footprint.feeEntries === 0 && footprint.payments === 0) {
    return { allowed: true };
  }

  return {
    allowed: false,
    code: 'FINANCIAL_RECORDS_EXIST',
    error:
      entityKind === 'student'
        ? 'Cannot delete record: Active financial ledger entries exist. Student must be marked as left (leftAt) to preserve audit compliance.'
        : 'Cannot delete record: Active financial ledger entries exist. Parent account must be retained to preserve audit compliance.',
  };
}

export async function checkStudentDeletionAllowed(studentId: string): Promise<DeletionGuardResult> {
  const { prisma } = await import('@/lib/db');
  const [feeEntries, payments] = await Promise.all([
    prisma.feeEntry.count({ where: { studentId } }),
    prisma.payment.count({ where: { studentId } }),
  ]);

  return evaluateDeletionGuard('student', { feeEntries, payments });
}

export async function checkParentDeletionAllowed(parentId: string): Promise<DeletionGuardResult> {
  const { prisma } = await import('@/lib/db');
  const payments = await prisma.payment.count({ where: { parentId } });
  return evaluateDeletionGuard('parent', { feeEntries: 0, payments });
}
