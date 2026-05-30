import { pgTable, text, timestamp, pgEnum } from 'drizzle-orm/pg-core';
import { ROLES } from '@zenthorax/shared';

export const roleEnum = pgEnum('role', [
  ROLES.SUPER_ADMIN,
  ROLES.RESTAURANT_MANAGER,
  ROLES.KITCHEN_STAFF,
]);

export const users = pgTable('users', {
  id: text('id').primaryKey(), // Supabase Auth UUID
  email: text('email').notNull().unique(),
  role: roleEnum('role').notNull().default(ROLES.RESTAURANT_MANAGER),
  fullName: text('full_name'),
  avatarUrl: text('avatar_url'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});
