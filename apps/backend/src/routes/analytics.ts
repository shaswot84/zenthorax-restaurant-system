import type { FastifyInstance } from 'fastify';
import type { Database } from '@zenthorax/database';
import type { Env } from '../config/env';
import { createAuthMiddleware } from '../middleware/auth';
import { requireRole, superAdminOnly } from '../middleware/rbac';
import { ROLES } from '@zenthorax/shared';
import { bills, orders, orderItems, restaurants } from '@zenthorax/database/schema';
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
