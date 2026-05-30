import type { SubscriptionStatus, PackageDuration } from '../constants/index';

export interface SubscriptionPackage {
  id: string;
  name: string;
  durationMonths: PackageDuration;
  priceNrs: number;
  registrationFeeNrs: number;
  description: string | null;
  isActive: boolean;
}

export interface Subscription {
  id: string;
  restaurantId: string;
  packageId: string;
  status: SubscriptionStatus;
  startDate: Date | null;
  endDate: Date | null;
  approvedBy: string | null;
  rejectionReason: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Payment {
  id: string;
  restaurantId: string;
  subscriptionId: string;
  amountNrs: number;
  paymentMethod: string;
  proofUrl: string | null;
  status: 'pending_verification' | 'verified' | 'rejected';
  verifiedBy: string | null;
  verifiedAt: Date | null;
  rejectionReason: string | null;
  createdAt: Date;
}
