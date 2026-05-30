import { pgTable, text, timestamp, integer, real, pgEnum } from 'drizzle-orm/pg-core';
import { users } from './users';
import { RESTAURANT_STATUSES } from '@zenthorax/shared';

export const restaurantStatusEnum = pgEnum('restaurant_status', [
  RESTAURANT_STATUSES.PENDING_APPROVAL,
  RESTAURANT_STATUSES.ACTIVE,
  RESTAURANT_STATUSES.SUSPENDED,
  RESTAURANT_STATUSES.INACTIVE,
]);

export const restaurants = pgTable('restaurants', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  ownerId: text('owner_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  contactNumber: text('contact_number').notNull(),
  address: text('address').notNull(),
  category: text('category'),
  description: text('description'),
  logoUrl: text('logo_url'),
  vatPercentage: real('vat_percentage').notNull().default(13),
  serviceChargePercentage: real('service_charge_percentage').notNull().default(10),
  taxPercentage: real('tax_percentage').notNull().default(0),
  status: restaurantStatusEnum('status').notNull().default(RESTAURANT_STATUSES.PENDING_APPROVAL),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});
