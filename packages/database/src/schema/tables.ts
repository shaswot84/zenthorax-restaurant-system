import { pgTable, text, timestamp, boolean } from 'drizzle-orm/pg-core';
import { restaurants } from './restaurants';

export const tables = pgTable('tables', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  restaurantId: text('restaurant_id')
    .notNull()
    .references(() => restaurants.id, { onDelete: 'cascade' }),
  tableNumber: text('table_number').notNull(),
  tableCode: text('table_code').notNull().unique(),
  qrUrl: text('qr_url'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export const tableSessions = pgTable('table_sessions', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  tableId: text('table_id')
    .notNull()
    .references(() => tables.id, { onDelete: 'cascade' }),
  sessionToken: text('session_token').notNull().unique(),
  isActive: boolean('is_active').notNull().default(true),
  openedAt: timestamp('opened_at', { withTimezone: true }).defaultNow().notNull(),
  closedAt: timestamp('closed_at', { withTimezone: true }),
});
