import type { Prisma } from '@prisma/client';

export type Money = Prisma.Decimal;
export type MoneyInput = Prisma.Decimal | string | number;

export type FeeEntryTypeValue = 'CHARGE' | 'ADJUSTMENT' | 'OFFLINE_PAYMENT';
export type PaymentStatusValue = 'PENDING' | 'SUCCESSFUL' | 'FAILED' | 'REFUNDED';
export type RefundStatusValue = 'PENDING' | 'CONFIRMED';

export const LEDGER_ALLOCATION_METHOD = 'CALCULATED_FIFO' as const;
export type LedgerAllocationMethod = typeof LEDGER_ALLOCATION_METHOD;

export interface LedgerFeeEntry {
  id?: string;
  studentId?: string;
  termId: string;
  type: FeeEntryTypeValue;
  amount: MoneyInput;
  note?: string | null;
  createdAt?: Date;
}

export interface LedgerRefund {
  id?: string;
  paymentId?: string;
  amount: MoneyInput;
  status: RefundStatusValue;
  createdAt?: Date;
}

export interface LedgerPayment {
  id?: string;
  studentId?: string;
  amount: MoneyInput;
  status: PaymentStatusValue;
  createdAt?: Date;
  verifiedAt?: Date | null;
  refunds?: readonly LedgerRefund[];
}

export interface TermDefinition {
  termId: string;
  name?: string;
  startDate: Date | string;
  endDate?: Date | string;
}

export interface TermCalendar {
  currentTermId?: string | null;
  terms: readonly TermDefinition[];
}

export type TermCalendarInput =
  | TermCalendar
  | readonly TermDefinition[]
  | Readonly<Record<string, Date | string | { startDate: Date | string; name?: string }>>;

export interface TermBalance {
  termId: string;
  termName: string;
  startDate: Date;
  charges: Money;
  grossCharges: Money;
  adjustments: Money;
  paid: Money;
  outstanding: Money;
  isCurrentTerm: boolean;
  allocationMethod: LedgerAllocationMethod;
}

export interface StudentBalanceSummary {
  studentId: string;
  asOfDate: Date;
  totalOutstanding: Money;
  amountDue: Money;
  creditBalance: Money;
  earlierTermsArrears: Money;
  currentTermBalance: Money;
  totalCharges: Money;
  totalPaid: Money;
  totalOfflinePayments: Money;
  totalOnlinePayments: Money;
  totalRefunds: Money;
  unallocatedPayment: Money;
  currentTermId: string | null;
  allocationMethod: LedgerAllocationMethod;
  termBreakdown: TermBalance[];
}

export interface TermBreakdown {
  currentTermId: string | null;
  allocationMethod: LedgerAllocationMethod;
  terms: TermBalance[];
}

export interface CalculateStudentBalanceInput {
  studentId: string;
  feeEntries: readonly LedgerFeeEntry[];
  payments?: readonly LedgerPayment[];
  termCalendar: TermCalendarInput;
  asOfDate?: Date;
  currentTermId?: string | null;
}

export interface ComputeStudentBalanceOptions {
  termCalendar?: TermCalendarInput;
  currentTermId?: string | null;
}

export interface PaymentAmountValidationOptions {
  minimumAmount?: MoneyInput;
  allowOverpayment?: boolean;
}

export interface PaymentAmountValidationResult {
  valid: boolean;
  error?: string;
}

export interface FinancialRecordFootprint {
  feeEntries: number;
  payments: number;
}

export type DeletionEntityKind = 'student' | 'parent';

export interface DeletionGuardResult {
  allowed: boolean;
  code?: 'FINANCIAL_RECORDS_EXIST';
  error?: string;
}
