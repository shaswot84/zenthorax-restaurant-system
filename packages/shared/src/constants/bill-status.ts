export const BILL_STATUSES = {
  BILL_REQUESTED: 'bill_requested',
  UNPAID: 'unpaid',
  PAID: 'paid',
  CANCELLED: 'cancelled',
} as const;

export type BillStatus = (typeof BILL_STATUSES)[keyof typeof BILL_STATUSES];

export const BILL_STATUS_LABELS: Record<BillStatus, string> = {
  bill_requested: 'Bill Requested',
  unpaid: 'Unpaid',
  paid: 'Paid',
  cancelled: 'Cancelled',
};

export const PAYMENT_MEDIUMS = {
  CASH: 'Cash',
  CARD: 'Card',
  QR: 'QR',
  MANUAL_QR_TRANSFER: 'Manual QR Transfer',
  BANK_TRANSFER: 'Bank Transfer',
  OTHER: 'Other',
} as const;

export type PaymentMedium = (typeof PAYMENT_MEDIUMS)[keyof typeof PAYMENT_MEDIUMS];

export const PAYMENT_MEDIUM_OPTIONS = Object.entries(PAYMENT_MEDIUMS).map(([value, label]) => ({
  value: value as PaymentMedium,
  label,
}));
