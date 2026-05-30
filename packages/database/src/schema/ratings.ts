import { pgTable, text, timestamp, integer } from 'drizzle-orm/pg-core';
import { restaurants } from './restaurants';
import { menuItems } from './menu';
import { tableSessions } from './tables';

export const ratings = pgTable('ratings', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  restaurantId: text('restaurant_id')
    .notNull()
    .references(() => restaurants.id, { onDelete: 'cascade' }),
  menuItemId: text('menu_item_id')
    .notNull()
    .references(() => menuItems.id, { onDelete: 'cascade' }),
  sessionId: text('session_id')
    .notNull()
    .references(() => tableSessions.id, { onDelete: 'cascade' }),
  rating: integer('rating').notNull(),
  comment: text('comment'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});
