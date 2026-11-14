export const OFFLINE_PAYMENT_METHODS = [
  'CASH',
  'BANK_TRANSFER',
  'POS',
  'TELLER',
] as const;

export type OfflinePaymentMethod = (typeof OFFLINE_PAYMENT_METHODS)[number];

export const OFFLINE_PAYMENT_METHOD_LABELS: Record<OfflinePaymentMethod, string> = {
  CASH: 'Cash',
  BANK_TRANSFER: 'Bank transfer',
  POS: 'POS',
  TELLER: 'Teller',
};

export const OFFLINE_PAYMENT_METHOD_OPTIONS = OFFLINE_PAYMENT_METHODS.map((method) => ({
  value: method,
  label: OFFLINE_PAYMENT_METHOD_LABELS[method],
}));
