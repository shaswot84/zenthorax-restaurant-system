import type { FastifyInstance } from 'fastify';
import type { Database } from '@zenthorax/database';
import type { Env } from '../config/env';
import { createAuthMiddleware } from '../middleware/auth';
import { requireRole, superAdminOnly } from '../middleware/rbac';
import { ROLES } from '@zenthorax/shared';
import { bills, orders, orderItems, restaurants, subscriptions, subscriptionPackages, payments } from '@zenthorax/database/schema';
import { eq, and, gte, sql, desc, inArray } from 'drizzle-orm';

interface AnalyticsDI { db: Database; env: Env; }

export async function analyticsRoutes(app: FastifyInstance, di: AnalyticsDI) {
  const { db } = di;
  const auth = createAuthMiddleware(di.env);

  async function verifyOwner(restaurantId: string, userId: string) {
    const r = await db.query.restaurants.findFirst({ where: (r: any, { eq }: any) => eq(r.id, restaurantId), columns: { ownerId: true } });
    return r?.ownerId === userId || (await db.query.users.findFirst({ where: (u: any, { eq }: any) => eq(u.id, userId), columns: { role: true } }))?.role === 'super_admin';
  }

  // ── RESTAURANT: KPI Summary ──
  app.get('/api/restaurants/:id/analytics/summary', { preHandler: [auth, requireRole(ROLES.RESTAURANT_MANAGER)] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    if (!(await verifyOwner(id, req.user!.id))) return reply.status(403).send({ success: false, error: { code: 'FORBIDDEN' } });

    const today = new Date(); today.setHours(0, 0, 0, 0);

    const [revenueToday] = await db.select({ total: sql<number>`COALESCE(SUM(total), 0)` }).from(bills)
      .where(and(eq(bills.restaurantId, id), eq(bills.status, 'paid' as any), gte(bills.paidAt, today)) as any);
    const [totalOrders] = await db.select({ count: sql<number>`COUNT(*)` }).from(orders)
      .where(and(eq(orders.restaurantId, id), inArray(orders.status, ['received', 'preparing', 'ready', 'delivered'] as any)) as any);
    const [allPaid] = await db.select({ total: sql<number>`COALESCE(SUM(total), 0)`, count: sql<number>`COUNT(*)` }).from(bills)
      .where(and(eq(bills.restaurantId, id), eq(bills.status, 'paid' as any)) as any);

    // Top item
    const topItems = await db.select({
      name: orderItems.menuItemName,
      totalQty: sql<number>`SUM(quantity)`,
    }).from(orderItems)
      .innerJoin(orders, eq(orderItems.orderId, orders.id))
      .where(and(eq(orders.restaurantId, id), inArray(orders.status, ['received', 'preparing', 'ready', 'delivered'] as any)) as any)
      .groupBy(orderItems.menuItemName).orderBy(desc(sql`SUM(quantity)`)).limit(1) as any;

    return reply.send({ success: true, data: {
      revenueToday: Number(revenueToday?.total ?? 0),
      activeOrders: Number(totalOrders?.count ?? 0),
      totalRevenue: Number(allPaid?.total ?? 0),
      totalPaidBills: Number(allPaid?.count ?? 0),
      avgOrderValue: Number(allPaid?.count ?? 0) > 0 ? Math.round(Number(allPaid!.total) / Number(allPaid!.count)) : 0,
      topItem: topItems[0]?.name ?? null,
    }});
  });

  // ── RESTAURANT: Revenue Trend ──
  app.get('/api/restaurants/:id/analytics/revenue', { preHandler: [auth, requireRole(ROLES.RESTAURANT_MANAGER)] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    if (!(await verifyOwner(id, req.user!.id))) return reply.status(403).send({ success: false });

    const period = (req.query as any).period ?? 'daily';
    const days = period === 'weekly' ? 7 : period === 'monthly' ? 30 : 14;

    const data = await db.select({
      day: sql<string>`DATE(paid_at)`,
      revenue: sql<number>`COALESCE(SUM(total), 0)`,
      count: sql<number>`COUNT(*)`,
    }).from(bills)
      .where(and(eq(bills.restaurantId, id), eq(bills.status, 'paid' as any), gte(bills.paidAt, new Date(Date.now() - days * 86400000))) as any)
      .groupBy(sql`DATE(paid_at)`).orderBy(sql`DATE(paid_at)`) as any;

    return reply.send({ success: true, data });
  });

  // ── RESTAURANT: Top Items ──
  app.get('/api/restaurants/:id/analytics/items', { preHandler: [auth, requireRole(ROLES.RESTAURANT_MANAGER)] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    if (!(await verifyOwner(id, req.user!.id))) return reply.status(403).send({ success: false });

    const items = await db.select({
      name: orderItems.menuItemName,
      quantity: sql<number>`SUM(quantity)`,
      revenue: sql<number>`SUM(total_price)`,
    }).from(orderItems)
      .innerJoin(orders, eq(orderItems.orderId, orders.id))
      .where(and(eq(orders.restaurantId, id), inArray(orders.status, ['received', 'preparing', 'ready', 'delivered'] as any)) as any)
      .groupBy(orderItems.menuItemName).orderBy(desc(sql`SUM(quantity)`)).limit(10) as any;

    return reply.send({ success: true, data: items });
  });

  // ── RESTAURANT: Paid vs Unpaid ──
  app.get('/api/restaurants/:id/analytics/bills', { preHandler: [auth, requireRole(ROLES.RESTAURANT_MANAGER)] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    if (!(await verifyOwner(id, req.user!.id))) return reply.status(403).send({ success: false });

    const data = await db.select({
      status: bills.status,
      count: sql<number>`COUNT(*)`,
      total: sql<number>`COALESCE(SUM(total), 0)`,
    }).from(bills).where(eq(bills.restaurantId, id)).groupBy(bills.status) as any;

    return reply.send({ success: true, data });
  });

  // ── RESTAURANT: Order Statistics ──
  app.get('/api/restaurants/:id/analytics/orders', { preHandler: [auth, requireRole(ROLES.RESTAURANT_MANAGER)] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    if (!(await verifyOwner(id, req.user!.id))) return reply.status(403).send({ success: false });

    const data = await db.select({
      status: orders.status,
      count: sql<number>`COUNT(*)`,
    }).from(orders).where(eq(orders.restaurantId, id)).groupBy(orders.status) as any;

    return reply.send({ success: true, data });
  });

  // ── SUPER ADMIN: Restaurant Comparison ──
  app.get('/api/admin/analytics/restaurants', { preHandler: [auth, superAdminOnly()] }, async (_req, reply) => {
    const list = await db.select({
      id: restaurants.id, name: restaurants.name, status: restaurants.status,
      orderCount: sql<number>`COALESCE((SELECT COUNT(*) FROM public.orders o WHERE o.restaurant_id = restaurants.id), 0)`,
      revenue: sql<number>`COALESCE((SELECT SUM(total) FROM public.bills b WHERE b.restaurant_id = restaurants.id AND b.status = 'paid'), 0)`,
    }).from(restaurants).orderBy(desc(sql`COALESCE((SELECT SUM(total) FROM public.bills b WHERE b.restaurant_id = restaurants.id AND b.status = 'paid'), 0)`)) as any;

    return reply.send({ success: true, data: list });
  });

  // ── SUPER ADMIN: Subscription Analytics ──
  app.get('/api/admin/analytics/subscriptions', { preHandler: [auth, superAdminOnly()] }, async (_req, reply) => {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 86400000);
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 86400000);

    // Package breakdown: TRUE active (end_date in future) by package
    const packageBreakdown = await db.select({
      packageName: subscriptionPackages.name,
      durationMonths: subscriptionPackages.durationMonths,
      activeCount: sql<number>`COUNT(*)`,
      subscriptionValue: sql<number>`COALESCE(SUM(${subscriptionPackages.priceNrs}), 0)`,
    }).from(subscriptions)
      .innerJoin(subscriptionPackages, eq(subscriptions.packageId, subscriptionPackages.id))
      .where(and(eq(subscriptions.status, 'active' as any), sql`end_date > NOW()` as any) as any)
      .groupBy(subscriptionPackages.name, subscriptionPackages.durationMonths, subscriptionPackages.priceNrs) as any;

    // Actual collected revenue from verified payments
    const [paymentRevenue] = await db.select({
      total: sql<number>`COALESCE(SUM(amount_nrs), 0)`,
    }).from(payments).where(eq(payments.status, 'verified' as any) as any);

    // Total subscription value (all active, not just trully active)
    const [totalSubValue] = await db.select({
      total: sql<number>`COALESCE(SUM(${subscriptionPackages.priceNrs}), 0)`,
    }).from(subscriptions)
      .innerJoin(subscriptionPackages, eq(subscriptions.packageId, subscriptionPackages.id))
      .where(eq(subscriptions.status, 'active' as any) as any);

    // True active: status=active AND end_date > NOW()
    const [trulyActive] = await db.select({ count: sql<number>`COUNT(*)` }).from(subscriptions)
      .where(and(eq(subscriptions.status, 'active' as any), sql`end_date > NOW()` as any) as any);

    // Grace period: status=active AND end_date passed but within last 7 days
    const [gracePeriod] = await db.select({ count: sql<number>`COUNT(*)` }).from(subscriptions)
      .where(and(
        eq(subscriptions.status, 'active' as any),
        sql`end_date < NOW()` as any,
        sql`end_date >= NOW() - INTERVAL '7 days'` as any,
      ) as any);

    // Expired: status=active AND end_date passed more than 7 days ago
    const [expired] = await db.select({ count: sql<number>`COUNT(*)` }).from(subscriptions)
      .where(and(
        eq(subscriptions.status, 'active' as any),
        sql`end_date < NOW() - INTERVAL '7 days'` as any,
      ) as any);

    const [totalRestaurants] = await db.select({ count: sql<number>`COUNT(*)` }).from(restaurants);

    // Upcoming expirations: active AND end_date within next 7 days (still in future)
    const upcoming = await db.select({
      restaurantName: restaurants.name,
      packageName: subscriptionPackages.name,
      endDate: subscriptions.endDate,
      daysLeft: sql<number>`EXTRACT(DAY FROM (end_date - NOW()))`,
    }).from(subscriptions)
      .innerJoin(restaurants, eq(subscriptions.restaurantId, restaurants.id))
      .innerJoin(subscriptionPackages, eq(subscriptions.packageId, subscriptionPackages.id))
      .where(and(
        eq(subscriptions.status, 'active' as any),
        sql`end_date > NOW()` as any,
        sql`end_date <= NOW() + INTERVAL '7 days'` as any,
      ) as any)
      .orderBy(subscriptions.endDate) as any;

    // Full sorted restaurant subscription status list
    const allSubs = await db.select({
      restaurantName: restaurants.name,
      restaurantSlug: restaurants.slug,
      packageName: subscriptionPackages.name,
      durationMonths: subscriptionPackages.durationMonths,
      status: subscriptions.status,
      startDate: subscriptions.startDate,
      endDate: subscriptions.endDate,
      daysRemaining: sql<number>`EXTRACT(DAY FROM (end_date - NOW()))`,
    }).from(subscriptions)
      .innerJoin(restaurants, eq(subscriptions.restaurantId, restaurants.id))
      .innerJoin(subscriptionPackages, eq(subscriptions.packageId, subscriptionPackages.id))
      .where(eq(subscriptions.status, 'active' as any) as any)
      .orderBy(sql`EXTRACT(DAY FROM (end_date - NOW()))`) as any;

    // Categorize and sort: Active (ascending days left), Grace Period, Expired
    const categorized = {
      active: allSubs
        .filter((s: any) => s.daysRemaining > 0)
        .sort((a: any, b: any) => a.daysRemaining - b.daysRemaining), // soonest expiring first
      gracePeriod: allSubs
        .filter((s: any) => s.daysRemaining <= 0 && s.daysRemaining > -7)
        .sort((a: any, b: any) => b.daysRemaining - a.daysRemaining), // most recently expired first
      expired: allSubs
        .filter((s: any) => s.daysRemaining <= -7)
        .sort((a: any, b: any) => a.daysRemaining - b.daysRemaining), // longest expired first
    };

    return reply.send({ success: true, data: {
      packageBreakdown,
      totalRestaurants: Number(totalRestaurants?.count ?? 0),
      activeSubscriptions: Number(trulyActive?.count ?? 0),
      gracePeriod: Number(gracePeriod?.count ?? 0),
      expired: Number(expired?.count ?? 0),
      collectedRevenue: Number(paymentRevenue?.total ?? 0),
      totalSubscriptionValue: Number(totalSubValue?.total ?? 0),
      upcomingExpirations: upcoming,
      restaurantStatuses: categorized,
    }});
  });

  // ── SUPER ADMIN: Subscription Revenue Trend ──
  app.get('/api/admin/analytics/subscription-revenue', { preHandler: [auth, superAdminOnly()] }, async (req, reply) => {
    const planFilter = (req.query as any).plan ?? 'all';
    const days = 60; // look back 60 days for meaningful trend

    let whereClause: any = and(
      eq(subscriptions.status, 'active' as any),
      sql`start_date > NOW() - INTERVAL '${days} days'` as any,
    );
    if (planFilter !== 'all') {
      whereClause = and(whereClause, eq(subscriptionPackages.durationMonths, parseInt(planFilter)) as any);
    }

    const data = await db.select({
      day: sql<string>`DATE(start_date)`,
      revenue: sql<number>`COALESCE(SUM(${subscriptionPackages.priceNrs}), 0)`,
      count: sql<number>`COUNT(*)`,
    }).from(subscriptions)
      .innerJoin(subscriptionPackages, eq(subscriptions.packageId, subscriptionPackages.id))
      .where(whereClause as any)
      .groupBy(sql`DATE(start_date)`).orderBy(sql`DATE(start_date)`) as any;

    return reply.send({ success: true, data });
  });

  // ── SUPER ADMIN: Platform Analytics ──
  app.get('/api/admin/analytics/platform', { preHandler: [auth, superAdminOnly()] }, async (_req, reply) => {
    const [totalRestaurants] = await db.select({ count: sql<number>`COUNT(*)` }).from(restaurants);
    const [activeRestaurants] = await db.select({ count: sql<number>`COUNT(*)` }).from(restaurants).where(eq(restaurants.status, 'active' as any) as any);
    const [totalOrders] = await db.select({ count: sql<number>`COUNT(*)` }).from(orders);
    const [totalRevenue] = await db.select({ total: sql<number>`COALESCE(SUM(total), 0)` }).from(bills).where(eq(bills.status, 'paid' as any) as any);

    // Top restaurants by revenue
    const topRes = await db.select({
      name: restaurants.name,
      revenue: sql<number>`COALESCE(SUM(${bills.total}), 0)`,
    }).from(bills).innerJoin(restaurants, eq(bills.restaurantId, restaurants.id))
      .where(eq(bills.status, 'paid' as any) as any)
      .groupBy(restaurants.name).orderBy(desc(sql`SUM(${bills.total})`)).limit(5) as any;

    return reply.send({ success: true, data: {
      totalRestaurants: Number(totalRestaurants?.count ?? 0),
      activeRestaurants: Number(activeRestaurants?.count ?? 0),
      totalOrders: Number(totalOrders?.count ?? 0),
      totalRevenue: Number(totalRevenue?.total ?? 0),
      topRestaurants: topRes,
    }});
  });
}
