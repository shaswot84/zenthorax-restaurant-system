import type { FastifyInstance } from 'fastify';
import type { Database } from '@zenthorax/database';
import type { Env } from '../config/env';
import { createAuthMiddleware } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { ROLES } from '@zenthorax/shared';
import { bills, orders, orderItems, tableSessions } from '@zenthorax/database/schema';
import { eq, and, desc, inArray } from 'drizzle-orm';
import { randomUUID } from 'crypto';

interface BillDI {
  db: Database;
  env: Env;
}

export async function billRoutes(app: FastifyInstance, di: BillDI) {
  const { db } = di;
  const auth = createAuthMiddleware(di.env);
  const managerOnly = [auth, requireRole(ROLES.RESTAURANT_MANAGER)];

  async function verifyOwnership(restaurantId: string, userId: string) {
    const r = await db.query.restaurants.findFirst({
      where: (r: any, { eq }: any) => eq(r.id, restaurantId),
      columns: { ownerId: true },
    });
    return r?.ownerId === userId;
  }

  // ---------------------------------------------------------------------------
  // POST /api/bills/request — Customer requests bill
  // Body: { sessionToken }
  // ---------------------------------------------------------------------------
  app.post('/api/bills/request', async (req, reply) => {
    const { sessionToken } = req.body as { sessionToken?: string };
    if (!sessionToken) {
      return reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: 'sessionToken is required.' } });
    }

    const session = await db.query.tableSessions.findFirst({
      where: (s: any, { eq, and }: any) => and(eq(s.sessionToken, sessionToken), eq(s.isActive, true)),
    });
    if (!session) {
      return reply.status(401).send({ success: false, error: { code: 'INVALID_SESSION' } });
    }

    // Get all orders for this session
    const sessionOrders = await db.query.orders.findMany({
      where: (o: any, { eq }: any) => eq(o.sessionId, session.id),
      with: { items: true },
    });

    if (sessionOrders.length === 0) {
      return reply.status(400).send({ success: false, error: { code: 'NO_ORDERS', message: 'No orders to bill.' } });
    }

    // Check if bill already exists
    const existingBill = await db.query.bills.findFirst({
      where: (b: any, { eq, and }: any) =>
        and(eq(b.sessionId, session.id), inArray(b.status, ['bill_requested', 'unpaid'] as any)),
    });

    if (existingBill) {
      return reply.send({ success: true, data: { id: existingBill.id, status: existingBill.status } });
    }

    // Calculate totals
    const restaurant = await db.query.restaurants.findFirst({
      where: (r: any, { eq }: any) => eq(r.id, sessionOrders[0]!.restaurantId),
    });
    if (!restaurant) return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND' } });

    const subtotal = sessionOrders.reduce((sum, o) => sum + o.items.reduce((s, i) => s + i.totalPrice, 0), 0);
    const discount = 0;
    const afterDiscount = subtotal - discount;
    const vat = Math.round(afterDiscount * (restaurant.vatPercentage / 100) * 100) / 100;
    const sc = Math.round(afterDiscount * (restaurant.serviceChargePercentage / 100) * 100) / 100;
    const tax = Math.round(afterDiscount * (restaurant.taxPercentage / 100) * 100) / 100;
    const total = Math.round((afterDiscount + vat + sc + tax) * 100) / 100;

    const billId = randomUUID();
    const table = await db.query.tables.findFirst({ where: (t: any, { eq }: any) => eq(t.id, session.tableId) });

    await db.insert(bills).values({
      id: billId, restaurantId: restaurant.id, sessionId: session.id, tableId: session.tableId,
      subtotal, discount, vat, serviceCharge: sc, tax, total, status: 'bill_requested',
    } as any);

    return reply.status(201).send({ success: true, data: { id: billId, status: 'bill_requested', subtotal, vat, sc, tax, total } });
  });

  // ---------------------------------------------------------------------------
  // GET /api/restaurants/:id/bills — List bills (filter by status)
  // ---------------------------------------------------------------------------
  app.get('/api/restaurants/:id/bills', { preHandler: managerOnly }, async (req, reply) => {
    const { id } = req.params as { id: string };
    if (!(await verifyOwnership(id, req.user!.id))) {
      return reply.status(403).send({ success: false, error: { code: 'FORBIDDEN' } });
    }
    const { status: st } = req.query as { status?: string };
    let where: any = eq(bills.restaurantId, id);
    if (st) where = and(where as any, eq(bills.status, st as any) as any);

    const results = await db.query.bills.findMany({
      where: where as any,
      orderBy: [desc(bills.createdAt)],
      with: { table: { columns: { tableNumber: true } } },
    });

    return reply.send({ success: true, data: results });
  });

  // ---------------------------------------------------------------------------
  // GET /api/restaurants/:id/bills/:billId — Bill detail with orders
  // ---------------------------------------------------------------------------
  app.get('/api/restaurants/:id/bills/:billId', { preHandler: managerOnly }, async (req, reply) => {
    const { id, billId } = req.params as { id: string; billId: string };
    if (!(await verifyOwnership(id, req.user!.id))) {
      return reply.status(403).send({ success: false, error: { code: 'FORBIDDEN' } });
    }
    const bill = await db.query.bills.findFirst({
      where: (b: any, { eq, and }: any) => and(eq(b.id, billId), eq(b.restaurantId, id)),
      with: { table: { columns: { tableNumber: true } } },
    });
    if (!bill) return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND' } });

    // Get session orders
    const sessionOrders = await db.query.orders.findMany({
      where: (o: any, { eq }: any) => eq(o.sessionId, bill.sessionId),
      with: { items: true },
    });

    return reply.send({ success: true, data: { ...bill, orders: sessionOrders } });
  });

  // ---------------------------------------------------------------------------
  // PATCH /api/restaurants/:id/bills/:billId — Update adjustments
  // ---------------------------------------------------------------------------
  app.patch('/api/restaurants/:id/bills/:billId', { preHandler: managerOnly }, async (req, reply) => {
    const { id, billId } = req.params as { id: string; billId: string };
    if (!(await verifyOwnership(id, req.user!.id))) {
      return reply.status(403).send({ success: false, error: { code: 'FORBIDDEN' } });
    }
    const { discount, vat, serviceCharge, tax } = req.body as any;
    const bill = await db.query.bills.findFirst({ where: (b: any, { eq, and }: any) => and(eq(b.id, billId), eq(b.restaurantId, id)) });
    if (!bill) return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND' } });

    const newDiscount = discount ?? bill.discount;
    const newVat = vat ?? bill.vat;
    const newSc = serviceCharge ?? bill.serviceCharge;
    const newTax = tax ?? bill.tax;
    const newTotal = bill.subtotal - newDiscount + newVat + newSc + newTax;

    await db.update(bills).set({
      discount: newDiscount, vat: newVat, serviceCharge: newSc, tax: newTax, total: newTotal,
    }).where(and(eq(bills.id, billId) as any, eq(bills.restaurantId, id) as any) as any);

    return reply.send({ success: true, data: { discount: newDiscount, vat: newVat, serviceCharge: newSc, tax: newTax, total: newTotal } });
  });

  // ---------------------------------------------------------------------------
  // POST /api/restaurants/:id/bills/:billId/mark-paid
  // ---------------------------------------------------------------------------
  app.post('/api/restaurants/:id/bills/:billId/mark-paid', { preHandler: managerOnly }, async (req, reply) => {
    const { id, billId } = req.params as { id: string; billId: string };
    if (!(await verifyOwnership(id, req.user!.id))) {
      return reply.status(403).send({ success: false, error: { code: 'FORBIDDEN' } });
    }
    const { paymentMedium } = req.body as { paymentMedium?: string };

    await db.update(bills).set({
      status: 'paid', paymentMedium: paymentMedium ?? 'Cash', paidAt: new Date(), paidByUserId: req.user!.id,
    } as any).where(and(eq(bills.id, billId) as any, eq(bills.restaurantId, id) as any) as any);

    // Close the table session
    const bill = await db.query.bills.findFirst({ where: (b: any, { eq }: any) => eq(b.id, billId) });
    if (bill) {
      await db.update(tableSessions).set({ isActive: false, closedAt: new Date() }).where(eq(tableSessions.id, bill.sessionId) as any);
    }

    return reply.send({ success: true, data: { status: 'paid' } });
  });

  // ---------------------------------------------------------------------------
  // POST /api/restaurants/:id/bills/:billId/mark-unpaid
  // ---------------------------------------------------------------------------
  app.post('/api/restaurants/:id/bills/:billId/mark-unpaid', { preHandler: managerOnly }, async (req, reply) => {
    const { id, billId } = req.params as { id: string; billId: string };
    if (!(await verifyOwnership(id, req.user!.id))) {
      return reply.status(403).send({ success: false, error: { code: 'FORBIDDEN' } });
    }
    await db.update(bills).set({ status: 'unpaid' as any }).where(
      and(eq(bills.id, billId) as any, eq(bills.restaurantId, id) as any) as any,
    );
    return reply.send({ success: true, data: { status: 'unpaid' } });
  });

  // ---------------------------------------------------------------------------
  // POST /api/restaurants/:id/bills/:billId/cancel
  // ---------------------------------------------------------------------------
  app.post('/api/restaurants/:id/bills/:billId/cancel', { preHandler: managerOnly }, async (req, reply) => {
    const { id, billId } = req.params as { id: string; billId: string };
    if (!(await verifyOwnership(id, req.user!.id))) {
      return reply.status(403).send({ success: false, error: { code: 'FORBIDDEN' } });
    }
    const { reason } = req.body as { reason?: string };
    await db.update(bills).set({ status: 'cancelled', cancellationReason: reason ?? null } as any).where(
      and(eq(bills.id, billId) as any, eq(bills.restaurantId, id) as any) as any,
    );
    return reply.send({ success: true, data: { status: 'cancelled' } });
  });

  // ---------------------------------------------------------------------------
  // GET /api/bills/:token/public — Customer view of bill (by session token)
  // ---------------------------------------------------------------------------
  app.get('/api/bills/:token/public', async (req, reply) => {
    const { token } = req.params as { token: string };
    const session = await db.query.tableSessions.findFirst({
      where: (s: any, { eq }: any) => eq(s.sessionToken, token),
    });
    if (!session) return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND' } });

    const bill = await db.query.bills.findFirst({
      where: (b: any, { eq }: any) => eq(b.sessionId, session.id),
      orderBy: [desc(bills.createdAt)],
      with: { table: { columns: { tableNumber: true } } },
    });
    if (!bill) return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND' } });

    const sessionOrders = await db.query.orders.findMany({
      where: (o: any, { eq }: any) => eq(o.sessionId, session.id),
      with: { items: true },
    });

    const restaurant = await db.query.restaurants.findFirst({
      where: (r: any, { eq }: any) => eq(r.id, bill.restaurantId),
    });

    return reply.send({ success: true, data: { ...bill, orders: sessionOrders, restaurantName: restaurant?.name } });
  });
}
