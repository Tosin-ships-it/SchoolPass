import 'server-only';

export {
  LEDGER_ALLOCATION_METHOD,
  type CalculateStudentBalanceInput,
  type ComputeStudentBalanceOptions,
  type DeletionEntityKind,
  type DeletionGuardResult,
  type FeeEntryTypeValue,
  type FinancialRecordFootprint,
  type LedgerAllocationMethod,
  type LedgerFeeEntry,
  type LedgerPayment,
  type LedgerRefund,
  type Money,
  type MoneyInput,
  type PaymentAmountValidationOptions,
  type PaymentAmountValidationResult,
  type PaymentStatusValue,
  type RefundStatusValue,
  type StudentBalanceSummary,
  type TermBalance,
  type TermBreakdown,
  type TermCalendar,
  type TermCalendarInput,
  type TermDefinition,
} from './types';

export {
  LedgerConfigurationError,
  LedgerValidationError,
  calculateStudentBalance,
  checkParentDeletionAllowed,
  checkStudentDeletionAllowed,
  computeStudentBalance,
  evaluateDeletionGuard,
  getTermFeeBreakdown,
  parseTermCalendarValue,
  validatePaymentAmount,
  validatePaymentAmountAgainstBalance,
} from './ledger';

export {
  FLUTTERWAVE_API_BASE_URL,
  FLUTTERWAVE_DEFAULT_TIMEOUT_MS,
  MIN_ONLINE_PAYMENT_AMOUNT_NGN,
  callFlutterwaveInitiatePayment,
  callFlutterwaveVerifyTransaction,
  generateInternalPaymentReference,
  getFlutterwaveEnvironment,
  getFlutterwavePublicKey,
  getFlutterwaveSecretKey,
  getFlutterwaveWebhookSecret,
  isFlutterwaveConfigured,
  isFlutterwaveWebhookConfigured,
  verifyFlutterwaveWebhookSignature,
  type FlutterwaveCustomerInfo,
  type FlutterwaveCustomizations,
  type FlutterwaveInitiateApiResponse,
  type FlutterwaveInitiatePayload,
  type FlutterwaveTransactionVerifyData,
  type FlutterwaveVerifyApiResponse,
  type FlutterwaveWebhookPayload,
} from './flutterwave';

export {
  initiateOnlinePayment,
  type InitiateOnlinePaymentInput,
  type InitiateOnlinePaymentResult,
  type InitiatePaymentOptions,
} from './api/initiate';

export {
  verifyPaymentTransaction,
  type VerifyPaymentOptions,
  type VerifyPaymentResult,
} from './api/verify';

export {
  handleFlutterwaveWebhook,
  type WebhookHandlerOptions,
} from './api/webhook';

export {
  getPortalData,
  type PortalDataResponse,
  type PortalBalanceData,
  type PortalFeeItem,
  type PortalPaymentItem,
  type PortalTermBreakdownItem,
  type PortalLinkedStudent,
  type PortalOptions,
} from './api/portal';

export {
  getReceiptData,
  type ReceiptData,
  type ReceiptResponse,
  type ReceiptOptions,
} from './api/receipt';

export {
  doesStudentClassMatchTarget,
  canonicalizeTargetClass,
  areSameClass,
} from './templates';
