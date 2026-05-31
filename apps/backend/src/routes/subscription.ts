import type { FastifyInstance } from 'fastify';
import type { Database } from '@zenthorax/database';
import type { Env } from '../config/env';
import { createAuthMiddleware } from '../middleware/auth';
import { requireRole, superAdminOnly } from '../middleware/rbac';
import { ROLES } from '@zenthorax/shared';
import { subscriptions, subscriptionPackages, payments } from '@zenthorax/database/schema';
import { eq, and, desc } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { createClient } from '@supabase/supabase-js';

interface SubDI {
  db: Database;
  env: Env;
}

export async function subscriptionRoutes(app: FastifyInstance, di: SubDI) {
  const { db, env } = di;
  const auth = createAuthMiddleware(env);
  const managerOnly = [auth, requireRole(ROLES.RESTAURANT_MANAGER)];
  const adminOnly = [auth, superAdminOnly()];
  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

  // ---------------------------------------------------------------------------
  // GET /api/restaurants/:id/subscription — Current + history
  // ---------------------------------------------------------------------------
  app.get('/api/restaurants/:id/subscription', { preHandler: managerOnly }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const r = await db.query.restaurants.findFirst({ where: (r: any, { eq }: any) => eq(r.id, id), columns: { ownerId: true } });
    if (r?.ownerId !== req.user!.id && req.user!.role !== 'super_admin') {
      return reply.status(403).send({ success: false, error: { code: 'FORBIDDEN' } });
    }

    const current = await db.query.subscriptions.findFirst({
      where: (s: any, { eq }: any) => eq(s.restaurantId, id),
      orderBy: [desc(subscriptions.createdAt)],
      with: { package: true },
    });

    const paymentHistory = await db.query.payments.findMany({
      where: (p: any, { eq }: any) => eq(p.restaurantId, id),
      orderBy: [desc(payments.createdAt)],
    });

    return reply.send({ success: true, data: { subscription: current, payments: paymentHistory } });
  });

  // ---------------------------------------------------------------------------
  // POST /api/restaurants/:id/subscription/request-change — Upgrade/downgrade
  // ---------------------------------------------------------------------------
  app.post('/api/restaurants/:id/subscription/request-change', { preHandler: managerOnly }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const { packageId, type } = req.body as { packageId?: string; type?: string };
    if (!packageId) return reply.status(400).send({ success: false, error: { code: 'VALIDATION' } });

    // Create new subscription request
    const subId = randomUUID();
    await db.insert(subscriptions).values({
      id: subId, restaurantId: id, packageId, status: 'pending',
    } as any);

    return reply.status(201).send({ success: true, data: { id: subId, status: 'pending', type: type ?? 'upgrade' } });
  });

  // ---------------------------------------------------------------------------
  // POST /api/restaurants/:id/subscription/request-renew — Renew current plan
  // ---------------------------------------------------------------------------
  app.post('/api/restaurants/:id/subscription/request-renew', { preHandler: managerOnly }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const current = await db.query.subscriptions.findFirst({
      where: (s: any, { eq }: any) => eq(s.restaurantId, id),
      orderBy: [desc(subscriptions.createdAt)],
    });
    if (!current) return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND' } });

    const subId = randomUUID();
    await db.insert(subscriptions).values({
      id: subId, restaurantId: id, packageId: current.packageId, status: 'pending',
    } as any);

    return reply.status(201).send({ success: true, data: { id: subId, status: 'pending', type: 'renewal' } });
  });

  // ---------------------------------------------------------------------------
  // POST /api/restaurants/:id/subscription/request-cancel — Request cancellation
  // ---------------------------------------------------------------------------
  app.post('/api/restaurants/:id/subscription/request-cancel', { preHandler: managerOnly }, async (req, reply) => {
    const { id } = req.params as { id: string };
    await db.update(subscriptions).set({ status: 'pending' as any })
      .where(and(eq(subscriptions.restaurantId, id) as any, eq(subscriptions.status, 'active' as any) as any) as any);
    return reply.send({ success: true, data: { status: 'pending', type: 'cancellation' } });
  });

  // ---------------------------------------------------------------------------
  // POST /api/restaurants/:id/payments/upload — Upload payment proof
  // ---------------------------------------------------------------------------
  app.post('/api/restaurants/:id/payments/upload', { preHandler: managerOnly }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const { subscriptionId, amountNrs, paymentMethod } = req.body as { subscriptionId?: string; amountNrs?: number; paymentMethod?: string };
    if (!subscriptionId || !amountNrs) return reply.status(400).send({ success: false, error: { code: 'VALIDATION' } });

    const data = await req.file();
    let proofUrl: string | null = null;
    if (data) {
      const buf = await data.toBuffer();
      const path = `payments/${id}/${randomUUID()}.png`;
      const { error } = await supabase.storage.from('payment-proofs').upload(path, buf, { contentType: 'image/png', upsert: true });
      if (!error) proofUrl = supabase.storage.from('payment-proofs').getPublicUrl(path).data.publicUrl;
    }

    const payId = randomUUID();
    await db.insert(payments).values({
      id: payId, restaurantId: id, subscriptionId, amountNrs, paymentMethod: paymentMethod ?? 'Bank Transfer', proofUrl, status: 'pending_verification',
    } as any);

    return reply.status(201).send({ success: true, data: { id: payId, status: 'pending_verification' } });
  });

  // ---------------------------------------------------------------------------
  // GET /api/admin/payments/pending — Pending payment verifications
  // ---------------------------------------------------------------------------
  app.get('/api/admin/payments/pending', { preHandler: adminOnly }, async (_req, reply) => {
    const pending = await db.query.payments.findMany({
      where: (p: any, { eq }: any) => eq(p.status, 'pending_verification'),
      orderBy: [desc(payments.createdAt)],
      with: { restaurant: { columns: { name: true, slug: true } } },
    });
    return reply.send({ success: true, data: pending });
  });

  // ---------------------------------------------------------------------------
  // POST /api/admin/payments/:id/verify — Verify payment
  // ---------------------------------------------------------------------------
  app.post('/api/admin/payments/:id/verify', { preHandler: adminOnly }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const payment = await db.query.payments.findFirst({ where: (p: any, { eq }: any) => eq(p.id, id) });
    if (!payment) return reply.status(404).send({ success: false });

    await db.update(payments).set({ status: 'verified', verifiedBy: req.user!.id, verifiedAt: new Date() } as any).where(eq(payments.id, id) as any);
    // Approve the linked subscription
    await db.update(subscriptions).set({ status: 'active', startDate: new Date(), approvedBy: req.user!.id } as any)
      .where(eq(subscriptions.id, payment.subscriptionId) as any);

    return reply.send({ success: true });
  });

  // ---------------------------------------------------------------------------
  // POST /api/admin/payments/:id/reject — Reject payment
  // ---------------------------------------------------------------------------
  app.post('/api/admin/payments/:id/reject', { preHandler: adminOnly }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const { reason } = req.body as { reason?: string };
    await db.update(payments).set({ status: 'rejected', rejectionReason: reason ?? null } as any).where(eq(payments.id, id) as any);
    return reply.send({ success: true });
  });
}
