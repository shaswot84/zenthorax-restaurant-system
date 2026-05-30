import { pgTable, text, timestamp, real, pgEnum } from 'drizzle-orm/pg-core';
import { restaurants } from './restaurants';
import { tables, tableSessions } from './tables';
import { users } from './users';
import { BILL_STATUSES } from '@zenthorax/shared';

export const billStatusEnum = pgEnum('bill_status', [
  BILL_STATUSES.BILL_REQUESTED,
  BILL_STATUSES.UNPAID,
  BILL_STATUSES.PAID,
  BILL_STATUSES.CANCELLED,
]);

export const paymentMediumEnum = pgEnum('payment_medium', [
  'Cash',
  'Card',
  'QR',
  'Manual QR Transfer',
  'Bank Transfer',
  'Other',
]);

export const bills = pgTable('bills', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  restaurantId: text('restaurant_id')
    .notNull()
    .references(() => restaurants.id, { onDelete: 'cascade' }),
  sessionId: text('session_id')
    .notNull()
    .references(() => tableSessions.id, { onDelete: 'cascade' }),
  tableId: text('table_id')
    .notNull()
    .references(() => tables.id, { onDelete: 'cascade' }),
  subtotal: real('subtotal').notNull(),
  discount: real('discount').notNull().default(0),
  vat: real('vat').notNull().default(0),
  serviceCharge: real('service_charge').notNull().default(0),
  tax: real('tax').notNull().default(0),
  total: real('total').notNull(),
  status: billStatusEnum('status').notNull().default(BILL_STATUSES.BILL_REQUESTED),
  paymentMedium: paymentMediumEnum('payment_medium'),
  paidAt: timestamp('paid_at', { withTimezone: true }),
  paidByUserId: text('paid_by_user_id').references(() => users.id),
  customerName: text('customer_name'),
  customerPhone: text('customer_phone'),
  cancellationReason: text('cancellation_reason'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});
