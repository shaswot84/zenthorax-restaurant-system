import { pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { users } from './users';

export const superAdminCredentials = pgTable('super_admin_credentials', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' })
    .unique(),
  credentialId: text('credential_id').notNull().unique(),
  publicKey: text('public_key').notNull(),
  counter: text('counter').notNull().default('0'),
  deviceType: text('device_type'),
  backedUp: text('backed_up').default('false'),
  transports: text('transports'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
});
