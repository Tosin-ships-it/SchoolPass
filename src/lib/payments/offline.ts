import 'server-only';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import {
  calculateStudentBalance,
  loadTermCalendarFromSettings,
  type LedgerPayment,
} from './ledger';
import type {
  FeeEntryTypeValue,
  StudentBalanceSummary,
  TermCalendar,
} from './types';
import { normalizeFeeAmount } from './templates';
import {
  OFFLINE_PAYMENT_METHODS,
  OFFLINE_PAYMENT_METHOD_LABELS,
  type OfflinePaymentMethod,
} from './offline-options';

export {
  OFFLINE_PAYMENT_METHODS,
  OFFLINE_PAYMENT_METHOD_LABELS,
  type OfflinePaymentMethod,
} from './offline-options';

export type OfflineEntryErrorCode =
  | 'configuration'
  | 'conflict'
  | 'not_found'
  | 'storage';

export class OfflineEntryError extends Error {
  readonly code: OfflineEntryErrorCode;

  constructor(code: OfflineEntryErrorCode, message: string) {
    super(message);
    this.name = 'OfflineEntryError';
    this.code = code;
  }
}

const CUID_PATTERN = /^c[^\s-]{8,}$/i;
const MONEY_PATTERN = /^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/;
const SIGNED_MONEY_PATTERN = /^-?(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/;
const MAX_MONEY = 9999999999.99;
const TERM_CALENDAR_ERROR =
  'The academic term calendar is not configured or has no active term. Contact an administrator before recording financial entries.';

const studentIdSchema = z
  .string({
    required_error: 'Select a student.',
    invalid_type_error: 'Select a valid student.',
  })
  .trim()
  .regex(CUID_PATTERN, 'Select a valid student.');

const positiveAmountSchema = z
  .string({
    required_error: 'Amount is required.',
    invalid_type_error: 'Amount must be a valid amount.',
  })
  .trim()
  .min(1, 'Amount is required.')
  .regex(MONEY_PATTERN, 'Enter a valid amount with no more than 2 decimal places.')
  .refine((value) => Number(value) > 0, 'Amount must be greater than zero.')
  .refine((value) => Number(value) <= MAX_MONEY, 'Amount is too large.')
  .transform(normalizeFeeAmount);

const signedAmountSchema = z
  .string({
    required_error: 'Adjustment amount is required.',
    invalid_type_error: 'Adjustment amount must be a valid amount.',
  })
  .trim()
  .min(1, 'Adjustment amount is required.')
  .regex(
    SIGNED_MONEY_PATTERN,
    'Enter a valid adjustment amount with no more than 2 decimal places.'
  )
  .refine((value) => Number(value) !== 0, 'Adjustment amount must not be zero.')
  .refine((value) => Math.abs(Number(value)) <= MAX_MONEY, 'Adjustment amount is too large.')
  .transform(normalizeSignedFeeAmount);

const methodSchema = z.enum(OFFLINE_PAYMENT_METHODS, {
  required_error: 'Payment method is required.',
  invalid_type_error: 'Select a valid payment method.',
});

const referenceSchema = z
  .string({
    required_error: 'Payment reference is required.',
    invalid_type_error: 'Payment reference must be valid text.',
  })
  .trim()
  .min(2, 'Payment reference must be at least 2 characters.')
  .max(100, 'Payment reference must not exceed 100 characters.')
  .refine(
    (value) => !value.includes('|'),
    'Payment reference cannot contain the pipe character.'
  );

const noteSchema = z
  .string({
    required_error: 'Note is required.',
    invalid_type_error: 'Note must be valid text.',
  })
  .trim()
  .min(2, 'Note must be at least 2 characters.')
  .max(500, 'Note must not exceed 500 characters.');

export const offlinePaymentSchema = z.object({
  studentId: studentIdSchema,
  amount: positiveAmountSchema,
  method: methodSchema,
  reference: referenceSchema,
  note: noteSchema,
});

export const adjustmentSchema = z.object({
  studentId: studentIdSchema,
  amount: signedAmountSchema,
  note: noteSchema,
});

export type OfflinePaymentInput = z.infer<typeof offlinePaymentSchema>;
export type AdjustmentInput = z.infer<typeof adjustmentSchema>;

export interface FeeDirectoryTermSummary {
  termId: string;
  termName: string;
  startDate: string;
  charges: string;
  adjustments: string;
  paid: string;
  outstanding: string;
  isCurrentTerm: boolean;
}

export interface FeeDirectorySummary {
  asOfDate: string;
  currentTermId: string | null;
  totalOutstanding: string;
  amountDue: string;
  creditBalance: string;
  earlierTermsArrears: string;
  currentTermBalance: string;
  totalCharges: string;
  totalPaid: string;
  totalOfflinePayments: string;
  totalOnlinePayments: string;
  totalRefunds: string;
  unallocatedPayment: string;
  termBreakdown: FeeDirectoryTermSummary[];
}

export interface FeeDirectoryHistoryItem {
  id: string;
  termId: string;
  type: FeeEntryTypeValue;
  amount: string;
  note: string;
  reference?: string;
  method?: OfflinePaymentMethod;
  adjustmentDirection?: 'credit' | 'debit';
  recordedBy: string;
  createdAt: string;
}

export interface FeeDirectoryStudent {
  id: string;
  studentNumber: string;
  name: string;
  className: string;
  summary: FeeDirectorySummary | null;
  balanceError?: string;
  history: FeeDirectoryHistoryItem[];
}

export interface FeeDirectoryBalanceStudent {
  id: string;
  studentNumber: string;
  name: string;
  className: string;
  outstandingBalance: string | null;
  balanceError?: string;
}

export type PaymentsDirectoryStudent = FeeDirectoryStudent | FeeDirectoryBalanceStudent;

export interface FeeDirectoryResult {
  students: FeeDirectoryStudent[];
  error?: string;
}

export interface FeeDirectoryBalanceResult {
  students: FeeDirectoryBalanceStudent[];
  error?: string;
}

interface ParsedOfflinePaymentNote {
  method: OfflinePaymentMethod;
  reference: string;
  note: string;
}

interface ParsedAdjustmentNote {
  direction: 'credit' | 'debit';
  note: string;
}

export function normalizeSignedFeeAmount(value: string): string {
  const trimmed = value.trim();
  const isNegative = trimmed.startsWith('-');
  const unsigned = isNegative ? trimmed.slice(1) : trimmed;
  return `${isNegative ? '-' : ''}${normalizeFeeAmount(unsigned)}`;
}

export function buildOfflineReferenceMarker(reference: string): string {
  return `| Ref: ${reference.trim()} |`;
}

export function formatOfflinePaymentNote(input: {
  method: OfflinePaymentMethod;
  reference: string;
  note: string;
}): string {
  return `Offline payment (${OFFLINE_PAYMENT_METHOD_LABELS[input.method]}) | Ref: ${input.reference.trim()} | Note: ${input.note.trim()}`;
}

export function parseOfflinePaymentNote(
  note: string | null | undefined
): ParsedOfflinePaymentNote | null {
  if (!note) return null;

  const match =
    /^Offline payment \(([^)]+)\) \| Ref: ([^|]+) \| Note: ([\s\S]*)$/.exec(note.trim());
  if (!match) return null;

  const method = OFFLINE_PAYMENT_METHODS.find(
    (candidate) => OFFLINE_PAYMENT_METHOD_LABELS[candidate] === match[1]
  );
  if (!method) return null;

  return {
    method,
    reference: match[2].trim(),
    note: match[3],
  };
}

export function formatAdjustmentNote(input: { amount: string; note: string }): string {
  const direction = input.amount.trim().startsWith('-') ? 'Credit or waiver' : 'Debit';
  return `Fee adjustment (${direction}) | Note: ${input.note.trim()}`;
}

export function parseAdjustmentNote(
  note: string | null | undefined
): ParsedAdjustmentNote | null {
  if (!note) return null;

  const match = /^Fee adjustment \((Credit or waiver|Debit)\) \| Note: ([\s\S]*)$/.exec(
    note.trim()
  );
  if (!match) return null;

  return {
    direction: match[1] === 'Debit' ? 'debit' : 'credit',
    note: match[2],
  };
}

export function resolveCurrentTermId(
  calendar: TermCalendar,
  asOfDate: Date = new Date()
): string | null {
  const terms = calendar.terms
    .map((term) => ({
      termId: term.termId,
      startDate: term.startDate instanceof Date ? term.startDate : new Date(term.startDate),
    }))
    .filter((term) => !Number.isNaN(term.startDate.getTime()));

  if (calendar.currentTermId) {
    const current = terms.find((term) => term.termId === calendar.currentTermId);
    if (!current) {
      throw new OfflineEntryError(
        'configuration',
        'The configured current term is not present in the academic term calendar.'
      );
    }
    if (current.startDate.getTime() > asOfDate.getTime()) {
      throw new OfflineEntryError(
        'configuration',
        'The configured current term has not started yet.'
      );
    }
    return current.termId;
  }

  const started = terms
    .filter((term) => term.startDate.getTime() <= asOfDate.getTime())
    .sort(
      (first, second) =>
        first.startDate.getTime() - second.startDate.getTime() ||
        first.termId.localeCompare(second.termId)
    );

  return started.length > 0 ? started[started.length - 1].termId : null;
}

async function loadCalendarForEntry(): Promise<TermCalendar> {
  try {
    const calendar = await loadTermCalendarFromSettings();
    if (!calendar) {
      throw new OfflineEntryError('configuration', TERM_CALENDAR_ERROR);
    }
    return calendar;
  } catch (error) {
    if (error instanceof OfflineEntryError) throw error;
    throw new OfflineEntryError('configuration', TERM_CALENDAR_ERROR);
  }
}

async function resolveRequiredTermId(): Promise<string> {
  const calendar = await loadCalendarForEntry();
  const termId = resolveCurrentTermId(calendar);
  if (!termId) {
    throw new OfflineEntryError('configuration', TERM_CALENDAR_ERROR);
  }
  return termId;
}

function isSerializationFailure(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: string }).code === 'P2034'
  );
}

async function withSerializableRetry<T>(operation: () => Promise<T>): Promise<T> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      if (!isSerializationFailure(error) || attempt === 2) throw error;
    }
  }

  throw new OfflineEntryError(
    'storage',
    'The fee ledger is temporarily unavailable. Please try again.'
  );
}

export async function recordOfflinePayment(
  input: OfflinePaymentInput,
  createdByStaffId: string
): Promise<{ feeEntryId: string; termId: string }> {
  const { prisma } = await import('@/lib/db');
  const termId = await resolveRequiredTermId();
  const amount = new Prisma.Decimal(input.amount);
  const note = formatOfflinePaymentNote(input);
  const referenceMarker = buildOfflineReferenceMarker(input.reference);

  return withSerializableRetry(() =>
    prisma.$transaction(
      async (transaction) => {
        const student = await transaction.student.findFirst({
          where: { id: input.studentId, leftAt: null },
          select: { id: true },
        });

        if (!student) {
          throw new OfflineEntryError('not_found', 'Active student not found.');
        }

        const duplicate = await transaction.feeEntry.findFirst({
          where: {
            studentId: input.studentId,
            type: 'OFFLINE_PAYMENT',
            note: { contains: referenceMarker },
          },
          select: { id: true },
        });

        if (duplicate) {
          throw new OfflineEntryError(
            'conflict',
            'This payment reference has already been recorded for this student.'
          );
        }

        const entry = await transaction.feeEntry.create({
          data: {
            studentId: input.studentId,
            termId,
            type: 'OFFLINE_PAYMENT',
            amount,
            note,
            createdByStaffId,
          },
          select: { id: true },
        });

        return { feeEntryId: entry.id, termId };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    )
  );
}

export async function recordAdjustment(
  input: AdjustmentInput,
  createdByStaffId: string
): Promise<{ feeEntryId: string; termId: string }> {
  const { prisma } = await import('@/lib/db');
  const termId = await resolveRequiredTermId();
  const amount = new Prisma.Decimal(input.amount);
  const note = formatAdjustmentNote(input);

  return withSerializableRetry(() =>
    prisma.$transaction(
      async (transaction) => {
        const student = await transaction.student.findFirst({
          where: { id: input.studentId, leftAt: null },
          select: { id: true },
        });

        if (!student) {
          throw new OfflineEntryError('not_found', 'Active student not found.');
        }

        const entry = await transaction.feeEntry.create({
          data: {
            studentId: input.studentId,
            termId,
            type: 'ADJUSTMENT',
            amount,
            note,
            createdByStaffId,
          },
          select: { id: true },
        });

        return { feeEntryId: entry.id, termId };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    )
  );
}

function toMoneyString(value: Prisma.Decimal): string {
  return value.toFixed(2);
}

export function projectFrontDeskStudent(
  student: {
    id: string;
    studentNumber: string;
    name: string;
    className: string;
  },
  outstandingBalance: string | null,
  balanceError?: string
): FeeDirectoryBalanceStudent {
  return {
    id: student.id,
    studentNumber: student.studentNumber,
    name: student.name,
    className: student.className,
    outstandingBalance,
    ...(balanceError ? { balanceError } : {}),
  };
}

function toDirectorySummary(summary: StudentBalanceSummary): FeeDirectorySummary {
  return {
    asOfDate: summary.asOfDate.toISOString(),
    currentTermId: summary.currentTermId,
    totalOutstanding: toMoneyString(summary.totalOutstanding),
    amountDue: toMoneyString(summary.amountDue),
    creditBalance: toMoneyString(summary.creditBalance),
    earlierTermsArrears: toMoneyString(summary.earlierTermsArrears),
    currentTermBalance: toMoneyString(summary.currentTermBalance),
    totalCharges: toMoneyString(summary.totalCharges),
    totalPaid: toMoneyString(summary.totalPaid),
    totalOfflinePayments: toMoneyString(summary.totalOfflinePayments),
    totalOnlinePayments: toMoneyString(summary.totalOnlinePayments),
    totalRefunds: toMoneyString(summary.totalRefunds),
    unallocatedPayment: toMoneyString(summary.unallocatedPayment),
    termBreakdown: summary.termBreakdown.map((term) => ({
      termId: term.termId,
      termName: term.termName,
      startDate: term.startDate.toISOString(),
      charges: toMoneyString(term.charges),
      adjustments: toMoneyString(term.adjustments),
      paid: toMoneyString(term.paid),
      outstanding: toMoneyString(term.outstanding),
      isCurrentTerm: term.isCurrentTerm,
    })),
  };
}

function toHistoryItem(entry: {
  id: string;
  termId: string;
  type: FeeEntryTypeValue;
  amount: Prisma.Decimal;
  note: string | null;
  createdAt: Date;
  createdByStaff: { name: string };
}): FeeDirectoryHistoryItem {
  const offline = entry.type === 'OFFLINE_PAYMENT' ? parseOfflinePaymentNote(entry.note) : null;
  const adjustment = entry.type === 'ADJUSTMENT' ? parseAdjustmentNote(entry.note) : null;

  return {
    id: entry.id,
    termId: entry.termId,
    type: entry.type,
    amount: toMoneyString(entry.amount),
    note: offline?.note ?? adjustment?.note ?? entry.note ?? '',
    reference: offline?.reference,
    method: offline?.method,
    adjustmentDirection: adjustment?.direction,
    recordedBy: entry.createdByStaff.name,
    createdAt: entry.createdAt.toISOString(),
  };
}

export async function loadFeeDirectory(asOfDate: Date = new Date()): Promise<FeeDirectoryResult> {
  const { prisma } = await import('@/lib/db');

  const students = await prisma.student.findMany({
    where: { leftAt: null },
    select: {
      id: true,
      studentNumber: true,
      name: true,
      className: true,
    },
    orderBy: [{ className: 'asc' }, { name: 'asc' }],
  });

  if (students.length === 0) {
    return { students: [] };
  }

  const studentIds = students.map((student) => student.id);
  const [entries, payments] = await Promise.all([
    prisma.feeEntry.findMany({
      where: { studentId: { in: studentIds } },
      select: {
        id: true,
        studentId: true,
        termId: true,
        type: true,
        amount: true,
        note: true,
        createdAt: true,
        createdByStaff: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.payment.findMany({
      where: { studentId: { in: studentIds } },
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
    }),
  ]);

  const entriesByStudent = new Map<string, typeof entries>();
  for (const entry of entries) {
    const group = entriesByStudent.get(entry.studentId) ?? [];
    group.push(entry);
    entriesByStudent.set(entry.studentId, group);
  }

  const paymentsByStudent = new Map<string, LedgerPayment[]>();
  for (const payment of payments) {
    const group = paymentsByStudent.get(payment.studentId) ?? [];
    group.push(payment);
    paymentsByStudent.set(payment.studentId, group);
  }

  let calendar: TermCalendar | null = null;
  let error: string | undefined;

  try {
    calendar = await loadTermCalendarFromSettings();
  } catch {
    error = TERM_CALENDAR_ERROR;
  }

  if (!calendar) {
    error = error ?? TERM_CALENDAR_ERROR;
  }

  return {
    error,
    students: students.map((student) => {
      const studentEntries = entriesByStudent.get(student.id) ?? [];
      const history = studentEntries.map(toHistoryItem);

      if (!calendar) {
        return {
          ...student,
          summary: null,
          balanceError: error,
          history,
        };
      }

      try {
        const summary = calculateStudentBalance({
          studentId: student.id,
          feeEntries: studentEntries,
          payments: paymentsByStudent.get(student.id) ?? [],
          termCalendar: calendar,
          asOfDate,
        });

        return {
          ...student,
          summary: toDirectorySummary(summary),
          history,
        };
      } catch {
        return {
          ...student,
          summary: null,
          balanceError:
            'The balance could not be calculated because the fee or term configuration is incomplete.',
          history,
        };
      }
    }),
  };
}

export async function loadFrontDeskFeeDirectory(
  asOfDate: Date = new Date()
): Promise<FeeDirectoryBalanceResult> {
  const { prisma } = await import('@/lib/db');

  const students = await prisma.student.findMany({
    where: { leftAt: null },
    select: {
      id: true,
      studentNumber: true,
      name: true,
      className: true,
    },
    orderBy: [{ className: 'asc' }, { name: 'asc' }],
  });

  if (students.length === 0) {
    return { students: [] };
  }

  const studentIds = students.map((student) => student.id);
  const [entries, payments] = await Promise.all([
    prisma.feeEntry.findMany({
      where: { studentId: { in: studentIds } },
      select: {
        id: true,
        studentId: true,
        termId: true,
        type: true,
        amount: true,
      },
    }),
    prisma.payment.findMany({
      where: { studentId: { in: studentIds } },
      select: {
        studentId: true,
        amount: true,
        status: true,
        refunds: {
          select: {
            amount: true,
            status: true,
          },
        },
      },
    }),
  ]);

  const entriesByStudent = new Map<string, typeof entries>();
  for (const entry of entries) {
    const group = entriesByStudent.get(entry.studentId) ?? [];
    group.push(entry);
    entriesByStudent.set(entry.studentId, group);
  }

  const paymentsByStudent = new Map<string, LedgerPayment[]>();
  for (const payment of payments) {
    const group = paymentsByStudent.get(payment.studentId) ?? [];
    group.push(payment);
    paymentsByStudent.set(payment.studentId, group);
  }

  let calendar: TermCalendar | null = null;
  let error: string | undefined;

  try {
    calendar = await loadTermCalendarFromSettings();
  } catch {
    error = TERM_CALENDAR_ERROR;
  }

  if (!calendar) {
    error = error ?? TERM_CALENDAR_ERROR;
    return {
      error,
      students: students.map((student) => projectFrontDeskStudent(student, null, error)),
    };
  }

  return {
    students: students.map((student) => {
      try {
        const summary = calculateStudentBalance({
          studentId: student.id,
          feeEntries: entriesByStudent.get(student.id) ?? [],
          payments: paymentsByStudent.get(student.id) ?? [],
          termCalendar: calendar,
          asOfDate,
        });

        return projectFrontDeskStudent(student, toMoneyString(summary.amountDue));
      } catch {
        return projectFrontDeskStudent(
          student,
          null,
          'The outstanding balance could not be calculated because the fee or term configuration is incomplete.'
        );
      }
    }),
  };
}
