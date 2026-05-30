import { pgTable, text, timestamp, integer, boolean, real, pgEnum } from 'drizzle-orm/pg-core';
import { restaurants } from './restaurants';
import { users } from './users';
import { SUBSCRIPTION_STATUSES } from '@zenthorax/shared';

export const subscriptionStatusEnum = pgEnum('subscription_status', [
  SUBSCRIPTION_STATUSES.PENDING,
  SUBSCRIPTION_STATUSES.ACTIVE,
  SUBSCRIPTION_STATUSES.REJECTED,
  SUBSCRIPTION_STATUSES.EXPIRED,
  SUBSCRIPTION_STATUSES.CANCELLED,
  SUBSCRIPTION_STATUSES.CHANGED,
  SUBSCRIPTION_STATUSES.GRACE_PERIOD,
]);

export const subscriptionPackages = pgTable('subscription_packages', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text('name').notNull(),
  durationMonths: integer('duration_months').notNull(),
  priceNrs: integer('price_nrs').notNull(),
  registrationFeeNrs: integer('registration_fee_nrs').notNull().default(500),
  description: text('description'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const subscriptions = pgTable('subscriptions', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  restaurantId: text('restaurant_id')
    .notNull()
    .references(() => restaurants.id, { onDelete: 'cascade' }),
  packageId: text('package_id')
    .notNull()
    .references(() => subscriptionPackages.id),
  status: subscriptionStatusEnum('status').notNull().default(SUBSCRIPTION_STATUSES.PENDING),
  startDate: timestamp('start_date', { withTimezone: true }),
  endDate: timestamp('end_date', { withTimezone: true }),
  approvedBy: text('approved_by').references(() => users.id),
  rejectionReason: text('rejection_reason'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export const paymentStatusEnum = pgEnum('payment_status', [
  'pending_verification',
  'verified',
  'rejected',
]);

export const payments = pgTable('payments', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  restaurantId: text('restaurant_id')
    .notNull()
    .references(() => restaurants.id, { onDelete: 'cascade' }),
  subscriptionId: text('subscription_id')
    .notNull()
    .references(() => subscriptions.id),
  amountNrs: integer('amount_nrs').notNull(),
  paymentMethod: text('payment_method').notNull(),
  proofUrl: text('proof_url'),
  status: paymentStatusEnum('status').notNull().default('pending_verification'),
  verifiedBy: text('verified_by').references(() => users.id),
  verifiedAt: timestamp('verified_at', { withTimezone: true }),
  rejectionReason: text('rejection_reason'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});
