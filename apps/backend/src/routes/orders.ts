import type { FastifyInstance } from 'fastify';
import type { Database } from '@zenthorax/database';
import type { Env } from '../config/env';
import { orders, orderItems, tableSessions } from '@zenthorax/database/schema';
import { eq, and, desc } from 'drizzle-orm';
import { randomUUID } from 'crypto';

interface OrderDI {
  db: Database;
  env: Env;
}

export async function orderRoutes(app: FastifyInstance, di: OrderDI) {
  const { db } = di;

  // Helper: validate session token and return session
  async function validateSession(token: string) {
    return db.query.tableSessions.findFirst({
      where: (s: any, { eq, and }: any) => and(eq(s.sessionToken, token), eq(s.isActive, true)),
    });
  }

  // ---------------------------------------------------------------------------
  // POST /api/orders — Anonymous: place a new order
  // Body: { sessionToken, items: [{ menuItemId, quantity }], notes? }
  // ---------------------------------------------------------------------------
  app.post('/api/orders', async (req, reply) => {
    const { sessionToken, items, notes } = req.body as {
      sessionToken?: string; items?: { menuItemId: string; quantity: number }[]; notes?: string;
    };

    if (!sessionToken || !items?.length) {
      return reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: 'sessionToken and items are required.' } });
    }

    const session = await validateSession(sessionToken);
    if (!session) {
      return reply.status(401).send({ success: false, error: { code: 'INVALID_SESSION', message: 'Invalid or expired session.' } });
    }

    // Get table and restaurant info
    const table = await db.query.tables.findFirst({
      where: (t: any, { eq }: any) => eq(t.id, session.tableId),
    });
    if (!table?.isActive) {
      return reply.status(400).send({ success: false, error: { code: 'TABLE_INACTIVE' } });
    }

    // Validate all items exist and are available
    const itemIds = items.map(i => i.menuItemId);
    const menuItems = await db.query.menuItems.findMany({
      where: (mi: any, { eq, and, inArray }: any) =>
        and(eq(mi.restaurantId, table.restaurantId), inArray(mi.id, itemIds)),
    });

    for (const item of items) {
      const menuItem = menuItems.find(mi => mi.id === item.menuItemId);
      if (!menuItem) {
        return reply.status(400).send({ success: false, error: { code: 'INVALID_ITEM', message: `Item ${item.menuItemId} not found.` } });
      }
      if (!menuItem.isAvailable) {
        return reply.status(400).send({ success: false, error: { code: 'ITEM_UNAVAILABLE', message: `${menuItem.name} is out of stock.` } });
      }
      if (item.quantity < 1 || item.quantity > 99) {
        return reply.status(400).send({ success: false, error: { code: 'INVALID_QTY', message: 'Quantity must be 1-99.' } });
      }
    }

    // Create order
    const orderId = randomUUID();
    await db.insert(orders).values({
      id: orderId, sessionId: session.id, restaurantId: table.restaurantId,
      tableId: table.id, status: 'received', notes: notes ?? null,
    } as any);

    // Create order items (with addon support)
    for (const item of items) {
      const mi = menuItems.find(m => m.id === item.menuItemId)!;
      let addonTotal = 0;
      // Fetch addon prices if addonIds provided
      if ((item as any).addonIds?.length > 0) {
        const selectedAddons = await db.query.addons.findMany({
          where: (a: any, { eq, inArray }: any) =>
            and(eq(a.menuItemId, mi.id), inArray(a.id, (item as any).addonIds)),
        });
        addonTotal = selectedAddons.reduce((s: number, a: any) => s + (a.price || 0), 0);
      }
      const totalPrice = (mi.price + addonTotal) * item.quantity;
      await db.insert(orderItems).values({
        id: randomUUID(), orderId, menuItemId: mi.id, menuItemName: mi.name,
        quantity: item.quantity, unitPrice: mi.price, totalPrice,
      });
    }

    return reply.status(201).send({ success: true, data: { id: orderId, status: 'received' } });
  });

  // ---------------------------------------------------------------------------
  // GET /api/orders/:id — Get order status (customer tracking)
  // ---------------------------------------------------------------------------
  app.get('/api/orders/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const order = await db.query.orders.findFirst({
      where: (o: any, { eq }: any) => eq(o.id, id),
      with: { items: true },
    });
    if (!order) return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND' } });
    return reply.send({ success: true, data: order });
  });

  // ---------------------------------------------------------------------------
  // GET /api/sessions/:token/orders — Get all orders for a session
  // ---------------------------------------------------------------------------
  app.get('/api/sessions/:token/orders', async (req, reply) => {
    const { token } = req.params as { token: string };
    const session = await validateSession(token);
    if (!session) return reply.status(401).send({ success: false, error: { code: 'INVALID_SESSION' } });

    const sessionOrders = await db.query.orders.findMany({
      where: (o: any, { eq }: any) => eq(o.sessionId, session.id),
      orderBy: [desc(orders.createdAt)],
      with: { items: true },
    });

    return reply.send({ success: true, data: sessionOrders });
  });
}
