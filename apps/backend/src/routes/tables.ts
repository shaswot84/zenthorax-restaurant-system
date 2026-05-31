import type { FastifyInstance } from 'fastify';
import type { Database } from '@zenthorax/database';
import type { Env } from '../config/env';
import { createAuthMiddleware } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { ROLES } from '@zenthorax/shared';
import { tables, tableSessions } from '@zenthorax/database/schema';
import { eq, and, desc } from 'drizzle-orm';
import { createClient } from '@supabase/supabase-js';
import QRCode from 'qrcode';
import { randomUUID } from 'crypto';

interface TableDI {
  db: Database;
  env: Env;
}

export async function tableRoutes(app: FastifyInstance, di: TableDI) {
  const { db, env } = di;
  const auth = createAuthMiddleware(env);
  const managerOnly = [auth, requireRole(ROLES.RESTAURANT_MANAGER)];
  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

  async function verifyOwnership(restaurantId: string, userId: string) {
    const r = await db.query.restaurants.findFirst({
      where: (r: any, { eq }: any) => eq(r.id, restaurantId),
      columns: { ownerId: true },
    });
    return r?.ownerId === userId;
  }

  // ---------------------------------------------------------------------------
  // GET /api/tables/validate — Public: validate QR scan
  // Query: ?slug=restaurant-slug&code=table-code
  // ---------------------------------------------------------------------------
  app.get('/api/tables/validate', async (req, reply) => {
    const { slug, code } = req.query as { slug?: string; code?: string };
    if (!slug || !code) {
      return reply.status(400).send({ success: false, error: { code: 'MISSING_PARAMS', message: 'slug and code are required.' } });
    }

    const restaurant = await db.query.restaurants.findFirst({
      where: (r: any, { eq, and }: any) => and(eq(r.slug, slug), eq(r.status, 'active')),
    });

    if (!restaurant) {
      return reply.status(404).send({ success: false, error: { code: 'INVALID', message: 'Restaurant not found.' } });
    }

    const table = await db.query.tables.findFirst({
      where: (t: any, { eq, and }: any) =>
        and(eq(t.restaurantId, restaurant.id), eq(t.tableCode, code), eq(t.isActive, true)),
    });

    if (!table) {
      return reply.status(404).send({ success: false, error: { code: 'INVALID', message: 'Table not found or inactive.' } });
    }

    // Create or resume a table session
    let session = await db.query.tableSessions.findFirst({
      where: (s: any, { eq, and }: any) =>
        and(eq(s.tableId, table.id), eq(s.isActive, true)),
      orderBy: [desc(tableSessions.openedAt)],
    });

    if (!session) {
      const token = randomUUID();
      await db.insert(tableSessions).values({
        tableId: table.id, sessionToken: token, isActive: true,
      } as any);
      session = { id: '', tableId: table.id, sessionToken: token, isActive: true, openedAt: new Date(), closedAt: null };
    }

    return reply.send({
      success: true,
      data: {
        restaurantId: restaurant.id,
        restaurantName: restaurant.name,
        tableId: table.id,
        tableNumber: table.tableNumber,
        sessionToken: session.sessionToken,
        vatPercentage: restaurant.vatPercentage,
        serviceChargePercentage: restaurant.serviceChargePercentage,
        taxPercentage: restaurant.taxPercentage,
      },
    });
  });

  // ---------------------------------------------------------------------------
  // GET /api/restaurants/:id/tables — List tables with active sessions
  // ---------------------------------------------------------------------------
  app.get('/api/restaurants/:id/tables', { preHandler: managerOnly }, async (req, reply) => {
    const { id } = req.params as { id: string };
    if (!(await verifyOwnership(id, req.user!.id))) {
      return reply.status(403).send({ success: false, error: { code: 'FORBIDDEN' } });
    }

    const results = await db.query.tables.findMany({
      where: (t: any, { eq }: any) => eq(t.restaurantId, id),
      orderBy: [desc(tables.createdAt)],
      with: { sessions: { where: (s: any, { eq }: any) => eq(s.isActive, true) } },
    });

    return reply.send({ success: true, data: results });
  });

  // ---------------------------------------------------------------------------
  // POST /api/restaurants/:id/tables — Create table + generate QR code
  // ---------------------------------------------------------------------------
  app.post('/api/restaurants/:id/tables', { preHandler: managerOnly }, async (req, reply) => {
    const { id } = req.params as { id: string };
    if (!(await verifyOwnership(id, req.user!.id))) {
      return reply.status(403).send({ success: false, error: { code: 'FORBIDDEN' } });
    }

    const { tableNumber } = req.body as { tableNumber: string };
    if (!tableNumber?.trim()) {
      return reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: 'Table number is required.' } });
    }

    // Check duplicates
    const existing = await db.query.tables.findFirst({
      where: (t: any, { eq, and }: any) => and(eq(t.restaurantId, id), eq(t.tableNumber, tableNumber.trim())),
    });
    if (existing) {
      return reply.status(409).send({ success: false, error: { code: 'DUPLICATE', message: 'Table number already exists.' } });
    }

    const tableCode = randomUUID();
    const restaurant = await db.query.restaurants.findFirst({
      where: (r: any, { eq }: any) => eq(r.id, id),
      columns: { slug: true },
    });

    const qrUrl = `https://zenthorax-restaurant-system-frontend.vercel.app/r/${restaurant!.slug}/table/${tableCode}`;

    // Generate QR code PNG
    const qrPng = await QRCode.toBuffer(qrUrl, { width: 400, margin: 2, type: 'png' });

    // Upload QR to Supabase Storage
    const qrPath = `${id}/${tableCode}.png`;
    await supabase.storage.from('qr-codes').upload(qrPath, qrPng, {
      contentType: 'image/png', upsert: true,
    });

    const table = {
      id: randomUUID(),
      restaurantId: id,
      tableNumber: tableNumber.trim(),
      tableCode,
      qrUrl,
      isActive: true,
    };
    await db.insert(tables).values(table as any);

    return reply.status(201).send({ success: true, data: table });
  });

  // ---------------------------------------------------------------------------
  // PATCH /api/restaurants/:id/tables/:tableId — Update table
  // ---------------------------------------------------------------------------
  app.patch('/api/restaurants/:id/tables/:tableId', { preHandler: managerOnly }, async (req, reply) => {
    const { id, tableId } = req.params as { id: string; tableId: string };
    if (!(await verifyOwnership(id, req.user!.id))) {
      return reply.status(403).send({ success: false, error: { code: 'FORBIDDEN' } });
    }
    const { tableNumber } = req.body as { tableNumber?: string };
    if (!tableNumber?.trim()) {
      return reply.status(400).send({ success: false, error: { code: 'VALIDATION' } });
    }
    await db.update(tables).set({ tableNumber: tableNumber.trim() }).where(
      and(eq(tables.id, tableId) as any, eq(tables.restaurantId, id) as any) as any,
    );
    return reply.send({ success: true });
  });

  // ---------------------------------------------------------------------------
  // DELETE /api/restaurants/:id/tables/:tableId — Soft-delete (deactivate)
  // ---------------------------------------------------------------------------
  app.delete('/api/restaurants/:id/tables/:tableId', { preHandler: managerOnly }, async (req, reply) => {
    const { id, tableId } = req.params as { id: string; tableId: string };
    if (!(await verifyOwnership(id, req.user!.id))) {
      return reply.status(403).send({ success: false, error: { code: 'FORBIDDEN' } });
    }
    // Close active sessions
    await db.update(tableSessions).set({ isActive: false, closedAt: new Date() }).where(
      and(eq(tableSessions.tableId, tableId) as any, eq(tableSessions.isActive, true) as any) as any,
    );
    // Deactivate table
    await db.update(tables).set({ isActive: false }).where(
      and(eq(tables.id, tableId) as any, eq(tables.restaurantId, id) as any) as any,
    );
    return reply.send({ success: true });
  });
}
