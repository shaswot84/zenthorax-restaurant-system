import { relations } from 'drizzle-orm/relations';
import { users } from './users';
import { restaurants } from './restaurants';
import { subscriptionPackages, subscriptions, payments } from './subscriptions';
import { menuCategories, menuItems } from './menu';
import { tables, tableSessions } from './tables';
import { orders, orderItems } from './orders';
import { bills } from './bills';
import { ratings } from './ratings';
import { kitchenStaff } from './kitchen';
import { governanceProposals, governanceVotes } from './governance';
import { auditLogs } from './audit';
import { superAdminCredentials } from './auth';

// --- Restaurant relations ---
export const restaurantRelations = relations(restaurants, ({ one, many }) => ({
  owner: one(users, { fields: [restaurants.ownerId], references: [users.id] }),
  menuCategories: many(menuCategories),
  menuItems: many(menuItems),
  tables: many(tables),
  orders: many(orders),
  bills: many(bills),
  ratings: many(ratings),
  subscriptions: many(subscriptions),
  payments: many(payments),
  kitchenStaff: many(kitchenStaff),
  auditLogs: many(auditLogs),
}));

// --- User relations ---
export const userRelations = relations(users, ({ one, many }) => ({
  restaurant: one(restaurants, { fields: [users.id], references: [restaurants.ownerId] }),
  approvedSubscriptions: many(subscriptions, { relationName: 'approver' }),
  verifiedPayments: many(payments, { relationName: 'verifier' }),
  approvedKitchenStaff: many(kitchenStaff, { relationName: 'approver' }),
  governanceProposals: many(governanceProposals),
  governanceVotes: many(governanceVotes),
  auditLogs: many(auditLogs),
  superAdminCredentials: many(superAdminCredentials),
  billsPaid: many(bills, { relationName: 'paidBy' }),
}));

// --- Subscription relations ---
export const subscriptionRelations = relations(subscriptions, ({ one }) => ({
  restaurant: one(restaurants, {
    fields: [subscriptions.restaurantId],
    references: [restaurants.id],
  }),
  package: one(subscriptionPackages, {
    fields: [subscriptions.packageId],
    references: [subscriptionPackages.id],
  }),
  approver: one(users, {
    fields: [subscriptions.approvedBy],
    references: [users.id],
    relationName: 'approver',
  }),
}));

// --- Payment relations ---
export const paymentRelations = relations(payments, ({ one }) => ({
  restaurant: one(restaurants, {
    fields: [payments.restaurantId],
    references: [restaurants.id],
  }),
  subscription: one(subscriptions, {
    fields: [payments.subscriptionId],
    references: [subscriptions.id],
  }),
  verifier: one(users, {
    fields: [payments.verifiedBy],
    references: [users.id],
    relationName: 'verifier',
  }),
}));

// --- Menu relations ---
export const menuCategoryRelations = relations(menuCategories, ({ one, many }) => ({
  restaurant: one(restaurants, {
    fields: [menuCategories.restaurantId],
    references: [restaurants.id],
  }),
  items: many(menuItems),
}));

export const menuItemRelations = relations(menuItems, ({ one, many }) => ({
  restaurant: one(restaurants, {
    fields: [menuItems.restaurantId],
    references: [restaurants.id],
  }),
  category: one(menuCategories, {
    fields: [menuItems.categoryId],
    references: [menuCategories.id],
  }),
  orderItems: many(orderItems),
  ratings: many(ratings),
}));

// --- Table relations ---
export const tableRelations = relations(tables, ({ one, many }) => ({
  restaurant: one(restaurants, {
    fields: [tables.restaurantId],
    references: [restaurants.id],
  }),
  sessions: many(tableSessions),
  orders: many(orders),
  bills: many(bills),
}));

export const tableSessionRelations = relations(tableSessions, ({ one, many }) => ({
  table: one(tables, { fields: [tableSessions.tableId], references: [tables.id] }),
  orders: many(orders),
  bills: many(bills),
}));

// --- Order relations ---
export const orderRelations = relations(orders, ({ one, many }) => ({
  session: one(tableSessions, {
    fields: [orders.sessionId],
    references: [tableSessions.id],
  }),
  restaurant: one(restaurants, {
    fields: [orders.restaurantId],
    references: [restaurants.id],
  }),
  table: one(tables, { fields: [orders.tableId], references: [tables.id] }),
  items: many(orderItems),
}));

export const orderItemRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, { fields: [orderItems.orderId], references: [orders.id] }),
  menuItem: one(menuItems, {
    fields: [orderItems.menuItemId],
    references: [menuItems.id],
  }),
}));

// --- Bill relations ---
export const billRelations = relations(bills, ({ one }) => ({
  restaurant: one(restaurants, {
    fields: [bills.restaurantId],
    references: [restaurants.id],
  }),
  session: one(tableSessions, {
    fields: [bills.sessionId],
    references: [tableSessions.id],
  }),
  table: one(tables, { fields: [bills.tableId], references: [tables.id] }),
  paidByUser: one(users, {
    fields: [bills.paidByUserId],
    references: [users.id],
    relationName: 'paidBy',
  }),
}));

// --- Rating relations ---
export const ratingRelations = relations(ratings, ({ one }) => ({
  restaurant: one(restaurants, {
    fields: [ratings.restaurantId],
    references: [restaurants.id],
  }),
  menuItem: one(menuItems, {
    fields: [ratings.menuItemId],
    references: [menuItems.id],
  }),
  session: one(tableSessions, {
    fields: [ratings.sessionId],
    references: [tableSessions.id],
  }),
}));

// --- Kitchen staff relations ---
export const kitchenStaffRelations = relations(kitchenStaff, ({ one }) => ({
  user: one(users, { fields: [kitchenStaff.userId], references: [users.id] }),
  restaurant: one(restaurants, {
    fields: [kitchenStaff.restaurantId],
    references: [restaurants.id],
  }),
  approver: one(users, {
    fields: [kitchenStaff.approvedBy],
    references: [users.id],
    relationName: 'approver',
  }),
}));

// --- Governance relations ---
export const governanceProposalRelations = relations(governanceProposals, ({ one, many }) => ({
  proposer: one(users, {
    fields: [governanceProposals.proposerId],
    references: [users.id],
  }),
  votes: many(governanceVotes),
}));

export const governanceVoteRelations = relations(governanceVotes, ({ one }) => ({
  proposal: one(governanceProposals, {
    fields: [governanceVotes.proposalId],
    references: [governanceProposals.id],
  }),
  voter: one(users, { fields: [governanceVotes.voterId], references: [users.id] }),
}));

// --- Audit log relations ---
export const auditLogRelations = relations(auditLogs, ({ one }) => ({
  actor: one(users, { fields: [auditLogs.actorId], references: [users.id] }),
  restaurant: one(restaurants, {
    fields: [auditLogs.restaurantId],
    references: [restaurants.id],
  }),
}));

// --- Super admin credential relations ---
export const superAdminCredentialRelations = relations(superAdminCredentials, ({ one }) => ({
  user: one(users, { fields: [superAdminCredentials.userId], references: [users.id] }),
}));
