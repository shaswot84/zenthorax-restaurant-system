import { pgTable, text, real, timestamp } from 'drizzle-orm/pg-core';
import { menuItems } from './menu';

export const addons = pgTable('addons', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  menuItemId: text('menu_item_id').notNull().references(() => menuItems.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  price: real('price').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});
