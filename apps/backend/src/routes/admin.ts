import type { FastifyInstance } from 'fastify';
import type { Database } from '@zenthorax/database';
import type { Env } from '../config/env';
import { createAuthMiddleware } from '../middleware/auth';
import { superAdminOnly } from '../middleware/rbac';
import { restaurants, subscriptions, subscriptionPackages } from '@zenthorax/database/schema';
import { eq, ilike, or, sql, desc, and } from 'drizzle-orm';

interface AdminDI {
  db: Database;
  env: Env;
}

export async function adminRoutes(app: FastifyInstance, di: AdminDI) {
  const { db } = di;
  const auth = createAuthMiddleware(di.env);
  const adminPreHandler = [auth, superAdminOnly()];

  // ---------------------------------------------------------------------------
  // GET /api/admin/dashboard/stats — Platform overview
  // ---------------------------------------------------------------------------
  app.get('/api/admin/dashboard/stats', { preHandler: adminPreHandler }, async (_req, reply) => {
    const totalRestaurants = await db.select({ count: sql<number>`count(*)` }).from(restaurants);
    const active = await db.select({ count: sql<number>`count(*)` }).from(restaurants).where(eq(restaurants.status, 'active' as any) as any);
    const pending = await db.select({ count: sql<number>`count(*)` }).from(restaurants).where(eq(restaurants.status, 'pending_approval' as any) as any);
    const suspended = await db.select({ count: sql<number>`count(*)` }).from(restaurants).where(eq(restaurants.status, 'suspended' as any) as any);
    const pendingSubs = await db.select({ count: sql<number>`count(*)` }).from(subscriptions).where(eq(subscriptions.status, 'pending' as any) as any);

    return reply.send({
      success: true,
      data: {
        totalRestaurants: Number(totalRestaurants[0]?.count ?? 0),
        activeRestaurants: Number(active[0]?.count ?? 0),
        pendingApprovals: Number(pending[0]?.count ?? 0),
        suspendedRestaurants: Number(suspended[0]?.count ?? 0),
        pendingSubscriptions: Number(pendingSubs[0]?.count ?? 0),
      },
    });
  });

  // ---------------------------------------------------------------------------
  // GET /api/admin/restaurants — Search & list restaurants
  // Query params: ?search=&status=&cursor=&limit=20
  // ---------------------------------------------------------------------------
  app.get('/api/admin/restaurants', { preHandler: adminPreHandler }, async (req, reply) => {
    const { search, status, cursor, limit = '20' } = req.query as Record<string, string>;
    const take = Math.min(parseInt(limit) || 20, 100);

    let conditions: any[] = [];

    if (search) {
      const term = `%${search}%`;
      conditions.push(
        or(
          ilike(restaurants.name, term),
          ilike(restaurants.slug, term),
          ilike(restaurants.contactNumber, term),
          ilike(restaurants.address, term),
        ) as any,
      );
    }

    if (status) {
      conditions.push(eq(restaurants.status, status as any) as any);
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const results = await db.query.restaurants.findMany({
      where: where as any,
      orderBy: [desc(restaurants.createdAt)],
      limit: take + 1,
      ...(cursor ? { offset: parseInt(cursor) } : {}),
    });

    const hasMore = results.length > take;
    const items = hasMore ? results.slice(0, take) : results;
    const nextCursor = hasMore ? String((parseInt(cursor || '0')) + take) : null;

    return reply.send({
      success: true,
      data: items.map((r) => ({
        id: r.id,
        name: r.name,
        slug: r.slug,
        contactNumber: r.contactNumber,
        status: r.status,
        createdAt: r.createdAt,
      })),
      meta: { cursor: nextCursor, hasMore, total: items.length },
    });
  });

  // ---------------------------------------------------------------------------
  // GET /api/admin/restaurants/:id — Full restaurant detail
  // ---------------------------------------------------------------------------
  app.get('/api/admin/restaurants/:id', { preHandler: adminPreHandler }, async (req, reply) => {
    const { id } = req.params as { id: string };

    const restaurant = await db.query.restaurants.findFirst({
      where: (r: any, { eq }: any) => eq(r.id, id),
    });

    if (!restaurant) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Restaurant not found.' },
      });
    }

    // Get subscription info
    const sub = await db.query.subscriptions.findFirst({
      where: (s: any, { eq }: any) => eq(s.restaurantId, id),
      orderBy: [desc(subscriptions.createdAt)],
      with: { package: true },
    });

    // Get counts
    const menuCount = await db
      .select({ count: sql<number>`count(*)` })
      .from((await import('@zenthorax/database/schema')).menuItems)
      .where(eq((await import('@zenthorax/database/schema')).menuItems.restaurantId, id) as any);
    const tableCount = await db
      .select({ count: sql<number>`count(*)` })
      .from((await import('@zenthorax/database/schema')).tables)
      .where(eq((await import('@zenthorax/database/schema')).tables.restaurantId, id) as any);
    const orderCount = await db
      .select({ count: sql<number>`count(*)` })
      .from((await import('@zenthorax/database/schema')).orders)
      .where(eq((await import('@zenthorax/database/schema')).orders.restaurantId, id) as any);

    return reply.send({
      success: true,
      data: {
        ...restaurant,
        subscription: sub ?? null,
        menuItemCount: Number(menuCount[0]?.count ?? 0),
        tableCount: Number(tableCount[0]?.count ?? 0),
        orderCount: Number(orderCount[0]?.count ?? 0),
      },
    });
  });

  // ---------------------------------------------------------------------------
  // GET /api/admin/subscriptions/pending — Pending requests
  // ---------------------------------------------------------------------------
  app.get('/api/admin/subscriptions/pending', { preHandler: adminPreHandler }, async (_req, reply) => {
    const pending = await db.query.subscriptions.findMany({
      where: (s: any, { eq }: any) => eq(s.status, 'pending'),
      orderBy: [desc(subscriptions.createdAt)],
      with: {
        restaurant: true,
        package: true,
      },
    });

    return reply.send({ success: true, data: pending });
  });

  // ---------------------------------------------------------------------------
  // POST /api/admin/subscriptions/:id/approve — Approve subscription
  // ---------------------------------------------------------------------------
  app.post('/api/admin/subscriptions/:id/approve', { preHandler: adminPreHandler }, async (req, reply) => {
    const user = req.user!;
    const { id } = req.params as { id: string };

    const sub = await db.query.subscriptions.findFirst({
      where: (s: any, { eq }: any) => eq(s.id, id),
      with: { package: true },
    });

    if (!sub) {
      return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Subscription not found.' } });
    }

    const now = new Date();
    const endDate = new Date(now);
    endDate.setMonth(endDate.getMonth() + ((sub.package as any)?.durationMonths ?? 1));

    await db.update(subscriptions).set({
      status: 'active',
      startDate: now,
      endDate,
      approvedBy: user.id,
    }).where(eq(subscriptions.id, id) as any);

    await db.update(restaurants).set({
      status: 'active',
    }).where(eq(restaurants.id, sub.restaurantId) as any);

    return reply.send({ success: true, data: { status: 'active', startDate: now, endDate } });
  });

  // ---------------------------------------------------------------------------
  // POST /api/admin/subscriptions/:id/reject — Reject subscription
  // ---------------------------------------------------------------------------
  app.post('/api/admin/subscriptions/:id/reject', { preHandler: adminPreHandler }, async (req, reply) => {
    const user = req.user!;
    const { id } = req.params as { id: string };
    const { reason } = req.body as { reason?: string };

    await db.update(subscriptions).set({
      status: 'rejected',
      rejectionReason: reason ?? null,
      approvedBy: user.id,
    }).where(eq(subscriptions.id, id) as any);

    return reply.send({ success: true, data: { status: 'rejected' } });
  });

  // ---------------------------------------------------------------------------
  // POST /api/admin/restaurants/:id/suspend — Suspend restaurant
  // ---------------------------------------------------------------------------
  app.post('/api/admin/restaurants/:id/suspend', { preHandler: adminPreHandler }, async (req, reply) => {
    const { id } = req.params as { id: string };

    await db.update(restaurants).set({ status: 'suspended' as any }).where(eq(restaurants.id, id) as any);
    return reply.send({ success: true, data: { status: 'suspended' } });
  });

  // ---------------------------------------------------------------------------
  // POST /api/admin/restaurants/:id/reactivate — Reactivate restaurant
  // ---------------------------------------------------------------------------
  app.post('/api/admin/restaurants/:id/reactivate', { preHandler: adminPreHandler }, async (req, reply) => {
    const { id } = req.params as { id: string };

    await db.update(restaurants).set({ status: 'active' }).where(eq(restaurants.id, id) as any);
    return reply.send({ success: true, data: { status: 'active' } });
  });
}
