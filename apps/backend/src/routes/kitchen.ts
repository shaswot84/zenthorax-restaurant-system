import type { FastifyInstance } from 'fastify';
import type { Database } from '@zenthorax/database';
import type { Env } from '../config/env';
import { createAuthMiddleware } from '../middleware/auth';
import { orders, kitchenStaff as kitchenStaffTable, restaurants as restaurantsTable, bills } from '@zenthorax/database/schema';
import { eq, and, desc, asc, inArray, ne } from 'drizzle-orm';
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

  // ---------------------------------------------------------------------------
  // PATCH /api/restaurants/:id/kitchen/orders/:orderId/cancel — Cancel order
  // ---------------------------------------------------------------------------
  app.patch('/api/restaurants/:id/kitchen/orders/:orderId/cancel', { preHandler: auth }, async (req, reply) => {
    const { id, orderId } = req.params as { id: string; orderId: string };
    if (!(await isStaff(id, req.user!.id))) {
      return reply.status(403).send({ success: false, error: { code: 'FORBIDDEN' } });
    }
    await db.update(orders).set({ status: 'cancelled' as any }).where(
      and(eq(orders.id, orderId) as any, eq(orders.restaurantId, id) as any) as any,
    );

    // Recalculate any existing bill for this order's session to exclude cancelled items
    const order = await db.query.orders.findFirst({ where: (o: any, { eq }: any) => eq(o.id, orderId) });
    if (order) {
      const bill = await db.query.bills.findFirst({
        where: (b: any, { eq, and, inArray: ia }: any) =>
          and(eq(b.sessionId, order.sessionId), ia(b.status, ['bill_requested', 'unpaid'] as any)),
      });
      if (bill) {
        // Recalculate subtotal from non-cancelled orders
        const activeOrders = await db.query.orders.findMany({
          where: (o: any, { eq, and, ne }: any) =>
            and(eq(o.sessionId, order.sessionId), ne(o.status, 'cancelled' as any)),
          with: { items: true },
        });
        const newSubtotal = activeOrders.reduce((sum, o) => sum + o.items.reduce((s, i) => s + i.totalPrice, 0), 0);
        const newTotal = newSubtotal - bill.discount + bill.vat + bill.serviceCharge + bill.tax;
        await db.update(bills).set({ subtotal: newSubtotal, total: newTotal } as any).where(eq(bills.id, bill.id) as any);
      }
    }

    return reply.send({ success: true, data: { status: 'cancelled' } });
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
