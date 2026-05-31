import type { FastifyInstance } from 'fastify';
import type { Database } from '@zenthorax/database';
import type { Env } from '../config/env';
import { createAuthMiddleware } from '../middleware/auth';
import { orders } from '@zenthorax/database/schema';
import { eq, and, inArray, desc } from 'drizzle-orm';
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
}
