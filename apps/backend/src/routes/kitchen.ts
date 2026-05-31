import type { FastifyInstance } from 'fastify';
import type { Database } from '@zenthorax/database';
import type { Env } from '../config/env';
import { createAuthMiddleware } from '../middleware/auth';
import { orders, kitchenStaff as kitchenStaffTable, restaurants as restaurantsTable } from '@zenthorax/database/schema';
import { eq, and, desc, asc } from 'drizzle-orm';
import { ORDER_STATUSES } from '@zenthorax/shared';

interface KitchenDI {
  db: Database;
  env: Env;
}

export async function kitchenRoutes(app: FastifyInstance, di: KitchenDI) {
  const { db } = di;
  const auth = createAuthMiddleware(di.env);

  // Verify the user is staff of this restaurant (manager or approved kitchen staff)
  async function isStaff(restaurantId: string, userId: string) {
    const r = await db.query.restaurants.findFirst({
      where: (r: any, { eq }: any) => eq(r.id, restaurantId),
      columns: { ownerId: true },
    });
    if (r?.ownerId === userId) return true;
    const ks = await db.query.kitchenStaff.findFirst({
      where: (k: any, { eq, and }: any) =>
        and(eq(k.userId, userId), eq(k.restaurantId, restaurantId), eq(k.isApproved, true)),
    });
    return !!ks;
  }

  // ---------------------------------------------------------------------------
  // GET /api/restaurants/:id/kitchen/orders — Active kitchen tickets
  // ---------------------------------------------------------------------------
  app.get('/api/restaurants/:id/kitchen/orders', { preHandler: auth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    if (!(await isStaff(id, req.user!.id))) {
      return reply.status(403).send({ success: false, error: { code: 'FORBIDDEN' } });
    }

    const activeOrders = await db.query.orders.findMany({
      where: (o: any, { eq, and, inArray: ia }: any) =>
        and(
          eq(o.restaurantId, id),
          ia(o.status, [ORDER_STATUSES.RECEIVED, ORDER_STATUSES.PREPARING]),
        ),
      orderBy: [desc(orders.createdAt)],
      with: {
        items: true,
        table: { columns: { tableNumber: true } },
      },
    });

    // Group by table
    const tickets = new Map<string, any>();
    for (const order of activeOrders) {
      const tableNum = (order.table as any)?.tableNumber ?? 'Unknown';
      if (!tickets.has(tableNum)) {
        tickets.set(tableNum, { tableNumber: tableNum, orders: [], latestOrderAt: order.createdAt });
      }
      tickets.get(tableNum)!.orders.push(order);
    }

    return reply.send({ success: true, data: Array.from(tickets.values()) });
  });

  // ---------------------------------------------------------------------------
  // PATCH /api/restaurants/:id/kitchen/orders/:orderId/status — Update status
  // ---------------------------------------------------------------------------
  app.patch('/api/restaurants/:id/kitchen/orders/:orderId/status', { preHandler: auth }, async (req, reply) => {
    const { id, orderId } = req.params as { id: string; orderId: string };
    const { status } = req.body as { status: string };

    if (!(await isStaff(id, req.user!.id))) {
      return reply.status(403).send({ success: false, error: { code: 'FORBIDDEN' } });
    }

    const validStatuses = [ORDER_STATUSES.RECEIVED, ORDER_STATUSES.PREPARING, ORDER_STATUSES.READY];
    if (!validStatuses.includes(status as any)) {
      return reply.status(400).send({ success: false, error: { code: 'INVALID_STATUS' } });
    }

    await db.update(orders).set({ status: status as any }).where(
      and(eq(orders.id, orderId) as any, eq(orders.restaurantId, id) as any) as any,
    );
    return reply.send({ success: true, data: { status } });
  });

  // -------------------------------------------------------------------------
  // GET /api/kitchen/restaurants — List all active restaurants (for staff to browse)
  // -------------------------------------------------------------------------
  app.get('/api/kitchen/restaurants', { preHandler: auth }, async (_req, reply) => {
    const list = await db.query.restaurants.findMany({
      where: (r: any, { eq }: any) => eq(r.status, 'active'),
      columns: { id: true, name: true, slug: true, address: true, logoUrl: true },
      orderBy: [asc(restaurantsTable.name)],
    });
    return reply.send({ success: true, data: list });
  });

  // -------------------------------------------------------------------------
  // GET /api/restaurants/:id/kitchen/staff-requests — Manager: list staff requests
  // -------------------------------------------------------------------------
  app.get('/api/restaurants/:id/kitchen/staff-requests', { preHandler: auth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    if (!(await isStaff(id, req.user!.id))) {
      return reply.status(403).send({ success: false, error: { code: 'FORBIDDEN' } });
    }

    const requests = await db.query.kitchenStaff.findMany({
      where: (ks: any, { eq }: any) => eq(ks.restaurantId, id),
      with: { user: { columns: { email: true, fullName: true, avatarUrl: true } } },
      orderBy: [desc(kitchenStaffTable.createdAt)],
    });

    return reply.send({ success: true, data: requests });
  });

  // -------------------------------------------------------------------------
  // POST /api/restaurants/:id/kitchen/staff-requests/:reqId/approve — Approve
  // -------------------------------------------------------------------------
  app.post('/api/restaurants/:id/kitchen/staff-requests/:reqId/approve', { preHandler: auth }, async (req, reply) => {
    const { id, reqId } = req.params as { id: string; reqId: string };
    if (!(await isStaff(id, req.user!.id))) {
      return reply.status(403).send({ success: false, error: { code: 'FORBIDDEN' } });
    }

    await db.update(kitchenStaffTable).set({ isApproved: true, approvedBy: req.user!.id }).where(
      and(eq(kitchenStaffTable.id, reqId) as any, eq(kitchenStaffTable.restaurantId, id) as any) as any,
    );
    return reply.send({ success: true });
  });

  // -------------------------------------------------------------------------
  // DELETE /api/restaurants/:id/kitchen/staff-requests/:reqId — Reject/remove
  // -------------------------------------------------------------------------
  app.delete('/api/restaurants/:id/kitchen/staff-requests/:reqId', { preHandler: auth }, async (req, reply) => {
    const { id, reqId } = req.params as { id: string; reqId: string };
    if (!(await isStaff(id, req.user!.id))) {
      return reply.status(403).send({ success: false, error: { code: 'FORBIDDEN' } });
    }

    await db.delete(kitchenStaffTable).where(
      and(eq(kitchenStaffTable.id, reqId) as any, eq(kitchenStaffTable.restaurantId, id) as any) as any,
    );
    return reply.send({ success: true });
  });
}
