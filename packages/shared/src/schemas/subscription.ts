import { z } from 'zod';

export const subscriptionApprovalSchema = z.object({
  approved: z.boolean(),
  rejectionReason: z.string().max(500).optional(),
});

export const subscriptionExtensionSchema = z.object({
  extensionDays: z.number().int().min(1).max(365),
  reason: z.string().min(5, 'Reason is required').max(500),
});

export const subscriptionChangeRequestSchema = z.object({
  newPackageType: z.enum(['monthly', 'three_month', 'six_month']),
  reason: z.string().min(5, 'Reason is required').max(500),
});

export type SubscriptionApprovalInput = z.infer<typeof subscriptionApprovalSchema>;
export type SubscriptionExtensionInput = z.infer<typeof subscriptionExtensionSchema>;
export type SubscriptionChangeRequestInput = z.infer<typeof subscriptionChangeRequestSchema>;
