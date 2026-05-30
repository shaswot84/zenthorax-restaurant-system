export const SUBSCRIPTION_STATUSES = {
  PENDING: 'pending',
  ACTIVE: 'active',
  REJECTED: 'rejected',
  EXPIRED: 'expired',
  CANCELLED: 'cancelled',
  CHANGED: 'changed',
  GRACE_PERIOD: 'grace_period',
} as const;

export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[keyof typeof SUBSCRIPTION_STATUSES];

export const SUBSCRIPTION_STATUS_LABELS: Record<SubscriptionStatus, string> = {
  pending: 'Pending Approval',
  active: 'Active',
  rejected: 'Rejected',
  expired: 'Expired',
  cancelled: 'Cancelled',
  changed: 'Changed',
  grace_period: 'Grace Period',
};

export const PACKAGE_DURATIONS = {
  ONE_MONTH: 1,
  THREE_MONTHS: 3,
  SIX_MONTHS: 6,
} as const;

export type PackageDuration = (typeof PACKAGE_DURATIONS)[keyof typeof PACKAGE_DURATIONS];

export const SUBSCRIPTION_PACKAGES = {
  MONTHLY: {
    name: 'Monthly Plan',
    durationMonths: 1,
    priceNrs: 2599,
    registrationFeeNrs: 500,
    firstPaymentNrs: 3099,
  },
  THREE_MONTH: {
    name: '3-Month Plan',
    durationMonths: 3,
    priceNrs: 7000,
    registrationFeeNrs: 500,
    firstPaymentNrs: 7500,
  },
  SIX_MONTH: {
    name: '6-Month Plan',
    durationMonths: 6,
    priceNrs: 13000,
    registrationFeeNrs: 500,
    firstPaymentNrs: 13500,
  },
} as const;

export const RESTAURANT_STATUSES = {
  PENDING_APPROVAL: 'pending_approval',
  ACTIVE: 'active',
  SUSPENDED: 'suspended',
  INACTIVE: 'inactive',
} as const;

export type RestaurantStatus = (typeof RESTAURANT_STATUSES)[keyof typeof RESTAURANT_STATUSES];

export const GRACE_PERIOD_DAYS = 7;
export const SUBSCRIPTION_EXPIRY_WARNING_DAYS = 7;
