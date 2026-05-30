import { pgTable, text, timestamp, integer, real, pgEnum } from 'drizzle-orm/pg-core';
import { restaurants } from './restaurants';
import { tables, tableSessions } from './tables';
import { menuItems } from './menu';
import { ORDER_STATUSES } from '@zenthorax/shared';

export const orderStatusEnum = pgEnum('order_status', [
  ORDER_STATUSES.RECEIVED,
  ORDER_STATUSES.PREPARING,
  ORDER_STATUSES.READY,
  ORDER_STATUSES.DELIVERED,
  ORDER_STATUSES.CANCELLED,
]);

export const orders = pgTable('orders', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  sessionId: text('session_id')
    .notNull()
    .references(() => tableSessions.id, { onDelete: 'cascade' }),
  restaurantId: text('restaurant_id')
    .notNull()
    .references(() => restaurants.id, { onDelete: 'cascade' }),
  tableId: text('table_id')
    .notNull()
    .references(() => tables.id, { onDelete: 'cascade' }),
  status: orderStatusEnum('status').notNull().default(ORDER_STATUSES.RECEIVED),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export const orderItems = pgTable('order_items', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  orderId: text('order_id')
    .notNull()
    .references(() => orders.id, { onDelete: 'cascade' }),
  menuItemId: text('menu_item_id')
    .notNull()
    .references(() => menuItems.id, { onDelete: 'cascade' }),
  menuItemName: text('menu_item_name').notNull(),
  quantity: integer('quantity').notNull(),
  unitPrice: real('unit_price').notNull(),
  totalPrice: real('total_price').notNull(),
});
