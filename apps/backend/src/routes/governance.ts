import type { FastifyInstance } from 'fastify';
import type { Database } from '@zenthorax/database';
import type { Env } from '../config/env';
import { createAuthMiddleware } from '../middleware/auth';
import { superAdminOnly } from '../middleware/rbac';
import { auditLogs, governanceProposals, governanceVotes, users as usersTable, superAdminCredentials, restaurants } from '@zenthorax/database/schema';
import { eq, desc, like, or, and, sql } from 'drizzle-orm';
import { randomUUID } from 'crypto';

interface GovDI { db: Database; env: Env; }

export async function governanceRoutes(app: FastifyInstance, di: GovDI) {
  const { db } = di;
  const auth = createAuthMiddleware(di.env);
  const adminOnly = [auth, superAdminOnly()];

  // ═══════════════════════════════════════════════════════════════
  // AUDIT LOGS
  // ═══════════════════════════════════════════════════════════════

  app.get('/api/admin/audit-logs', { preHandler: adminOnly }, async (req, reply) => {
    const { search, action, limit = '50', offset = '0' } = req.query as Record<string, string>;
    const take = Math.min(parseInt(limit) || 50, 100);
    const skip = parseInt(offset) || 0;
    let conditions: any[] = [];
    if (search) { const term = `%${search}%`; conditions.push(or(like(auditLogs.action, term), like(auditLogs.targetType, term)) as any); }
    if (action) conditions.push(eq(auditLogs.action, action) as any);
    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const [total] = await db.select({ count: sql<number>`COUNT(*)` }).from(auditLogs).where(where as any);
    const logs = await db.query.auditLogs.findMany({
      where: where as any, orderBy: [desc(auditLogs.createdAt)], limit: take, offset: skip,
      with: { actor: { columns: { email: true } }, restaurant: { columns: { name: true } } },
    });
    return reply.send({ success: true, data: logs, meta: { total: Number(total?.count ?? 0), limit: take, offset: skip } });
  });

  app.get('/api/admin/audit-logs/export', { preHandler: adminOnly }, async (req, reply) => {
    const { search } = req.query as Record<string, string>;
    let conditions: any[] = [];
    if (search) { const term = `%${search}%`; conditions.push(or(like(auditLogs.action, term), like(auditLogs.targetType, term)) as any); }
    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const logs = await db.query.auditLogs.findMany({
      where: where as any, orderBy: [desc(auditLogs.createdAt)], limit: 1000,
      with: { actor: { columns: { email: true } }, restaurant: { columns: { name: true } } },
    });
    const header = 'Time,Actor,Action,Target Type,Target ID,Restaurant,IP Address\n';
    const rows = logs.map(l => `"${l.createdAt}","${l.actor?.email ?? 'System'}","${l.action}","${l.targetType ?? ''}","${l.targetId ?? ''}","${l.restaurant?.name ?? ''}","${l.ipAddress ?? ''}"`).join('\n');
    reply.header('Content-Type', 'text/csv');
    reply.header('Content-Disposition', 'attachment; filename="audit-logs.csv"');
    return reply.send(header + rows);
  });

  // ═══════════════════════════════════════════════════════════════
  // GOVERNANCE PROPOSALS
  // ═══════════════════════════════════════════════════════════════

  app.get('/api/admin/governance/proposals', { preHandler: adminOnly }, async (_req, reply) => {
    const proposals = await db.query.governanceProposals.findMany({
      orderBy: [desc(governanceProposals.createdAt)],
      with: { proposer: { columns: { email: true } }, votes: { with: { voter: { columns: { email: true } } } } },
    });
    return reply.send({ success: true, data: proposals });
  });

  app.post('/api/admin/governance/proposals', { preHandler: adminOnly }, async (req, reply) => {
    const { actionType, targetId, reason } = req.body as { actionType?: string; targetId?: string; reason?: string };
    if (!actionType || !reason) return reply.status(400).send({ success: false, error: { code: 'VALIDATION' } });
    const [adminCount] = await db.select({ count: sql<number>`COUNT(*)` }).from(usersTable).where(eq(usersTable.role, 'super_admin' as any) as any);
    const required = Math.max(1, Math.floor(Number(adminCount?.count ?? 1) / 2));
    const id = randomUUID();
    await db.insert(governanceProposals).values({ id, proposerId: req.user!.id, actionType, targetId: targetId ?? null, reason, requiredApprovals: required } as any);
    return reply.status(201).send({ success: true, data: { id, requiredApprovals: required } });
  });

  app.post('/api/admin/governance/proposals/:id/vote', { preHandler: adminOnly }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const { vote, reason } = req.body as { vote?: string; reason?: string };
    if (!vote || !['approve', 'reject'].includes(vote)) return reply.status(400).send({ success: false });
    const proposal = await db.query.governanceProposals.findFirst({ where: (p: any, { eq }: any) => eq(p.id, id) });
    if (!proposal || proposal.status !== 'pending') return reply.status(400).send({ success: false, error: { code: 'NOT_PENDING' } });
    const existing = await db.query.governanceVotes.findFirst({ where: (v: any, { eq, and }: any) => and(eq(v.proposalId, id), eq(v.voterId, req.user!.id)) });
    if (existing) return reply.status(409).send({ success: false, error: { code: 'ALREADY_VOTED' } });
    await db.insert(governanceVotes).values({ id: randomUUID(), proposalId: id, voterId: req.user!.id, vote: vote as any, reason: reason ?? null } as any);
    const [voteCount] = await db.select({ count: sql<number>`COUNT(*)` }).from(governanceVotes).where(and(eq(governanceVotes.proposalId, id), eq(governanceVotes.vote, 'approve' as any)) as any);
    const approvedCount = Number(voteCount?.count ?? 0);
    if (approvedCount >= proposal.requiredApprovals) {
      await db.update(governanceProposals).set({ status: 'approved' as any }).where(eq(governanceProposals.id, id) as any);
    }
    return reply.send({ success: true, data: { approvedCount, required: proposal.requiredApprovals, status: approvedCount >= proposal.requiredApprovals ? 'approved' : 'pending' } });
  });

  app.post('/api/admin/governance/proposals/:id/execute', { preHandler: adminOnly }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const proposal = await db.query.governanceProposals.findFirst({ where: (p: any, { eq }: any) => eq(p.id, id) });
    if (!proposal) return reply.status(404).send({ success: false });
    if (proposal.status !== 'approved') return reply.status(400).send({ success: false, error: { code: 'NOT_APPROVED' } });

    // Execute the actual action based on proposal type
    if (proposal.actionType === 'add_super_admin' && proposal.targetId) {
      await db.update(usersTable).set({ role: 'super_admin' as any }).where(eq(usersTable.email, proposal.targetId) as any);
    } else if (proposal.actionType === 'remove_super_admin' && proposal.targetId) {
      await db.update(usersTable).set({ role: 'restaurant_manager' as any }).where(eq(usersTable.email, proposal.targetId) as any);
    } else if (proposal.actionType === 'hard_delete_restaurant' && proposal.targetId) {
      await db.delete(restaurants).where(eq(restaurants.id, proposal.targetId) as any);
    }

    await db.update(governanceProposals).set({ status: 'executed' as any }).where(eq(governanceProposals.id, id) as any);
    return reply.send({ success: true, data: { status: 'executed', actionType: proposal.actionType } });
  });

  // ═══════════════════════════════════════════════════════════════
  // WEBAUTHN / PASSKEY
  // ═══════════════════════════════════════════════════════════════

  const getRPConfig = () => ({
    rpName: 'Zenthorax Admin',
    rpID: di.env.SUPABASE_URL.includes('localhost') ? 'localhost' : 'zenthorax-restaurant-system-frontend.vercel.app',
    origin: di.env.SUPABASE_URL.includes('localhost') ? 'http://localhost:3000' : 'https://zenthorax-restaurant-system-frontend.vercel.app',
  });

  // GET /api/admin/webauthn/register-options
  app.get('/api/admin/webauthn/register-options', { preHandler: adminOnly }, async (req, reply) => {
    const { generateRegistrationOptions } = await import('@simplewebauthn/server');
    const rp = getRPConfig();
    const user = req.user!;
    const existing = await db.query.superAdminCredentials.findFirst({ where: (c: any, { eq }: any) => eq(c.userId, user.id) });
    const userIdBytes = new TextEncoder().encode(user.id);
    const options = await generateRegistrationOptions({
      rpName: rp.rpName, rpID: rp.rpID,
      userID: userIdBytes,
      userName: user.email,
      attestationType: 'none',
      authenticatorSelection: { residentKey: 'preferred', userVerification: 'preferred' },
      excludeCredentials: existing ? [{ id: existing.credentialId } as any] : [],
    });
    (app as any)._webauthnRegChallenge = { ...(app as any)._webauthnRegChallenge, [user.id]: options.challenge };
    return reply.send({ success: true, data: options });
  });

  // POST /api/admin/webauthn/register — Verify & store
  app.post('/api/admin/webauthn/register', { preHandler: adminOnly }, async (req, reply) => {
    const { verifyRegistrationResponse } = await import('@simplewebauthn/server');
    const rp = getRPConfig();
    const user = req.user!;
    const body = req.body as any;
    const challenge = (app as any)._webauthnRegChallenge?.[user.id];
    if (!challenge) return reply.status(400).send({ success: false, error: { code: 'NO_CHALLENGE' } });
    try {
      const verification = await verifyRegistrationResponse({ response: body, expectedChallenge: challenge, expectedOrigin: rp.origin, expectedRPID: rp.rpID });
      if (verification.verified && verification.registrationInfo) {
        await db.delete(superAdminCredentials).where(eq(superAdminCredentials.userId, user.id) as any);
        await db.insert(superAdminCredentials).values({
          id: randomUUID(), userId: user.id,
          credentialId: verification.registrationInfo.credential.id,
          publicKey: Buffer.from(verification.registrationInfo.credential.publicKey).toString('base64'),
          counter: String(verification.registrationInfo.credential.counter),
        } as any);
        delete (app as any)._webauthnRegChallenge[user.id];
        return reply.send({ success: true, data: { registered: true } });
      }
      return reply.status(400).send({ success: false, error: { code: 'VERIFICATION_FAILED' } });
    } catch (err: any) { return reply.status(400).send({ success: false, error: { code: 'VERIFICATION_ERROR', message: err.message } }); }
  });

  // GET /api/admin/webauthn/auth-options
  app.get('/api/admin/webauthn/auth-options', { preHandler: adminOnly }, async (req, reply) => {
    const { generateAuthenticationOptions } = await import('@simplewebauthn/server');
    const rp = getRPConfig();
    const user = req.user!;
    const options = await generateAuthenticationOptions({ rpID: rp.rpID, userVerification: 'preferred' });
    (app as any)._webauthnAuthChallenge = { ...(app as any)._webauthnAuthChallenge, [user.id]: options.challenge };
    return reply.send({ success: true, data: options });
  });

  // POST /api/admin/webauthn/verify
  app.post('/api/admin/webauthn/verify', { preHandler: adminOnly }, async (req, reply) => {
    const { verifyAuthenticationResponse } = await import('@simplewebauthn/server');
    const rp = getRPConfig();
    const user = req.user!;
    const body = req.body as any;
    const cred = await db.query.superAdminCredentials.findFirst({ where: (c: any, { eq }: any) => eq(c.userId, user.id) });
    if (!cred) return reply.status(400).send({ success: false, error: { code: 'NO_CREDENTIAL' } });
    const challenge = (app as any)._webauthnAuthChallenge?.[user.id];
    if (!challenge) return reply.status(400).send({ success: false, error: { code: 'NO_CHALLENGE' } });
    try {
      const verification = await verifyAuthenticationResponse({
        response: body, expectedChallenge: challenge, expectedOrigin: rp.origin, expectedRPID: rp.rpID,
        credential: { id: cred.credentialId, publicKey: new Uint8Array(Buffer.from(cred.publicKey, 'base64')), counter: parseInt(cred.counter || '0') },
      });
      if (verification.verified) {
        await db.update(superAdminCredentials).set({ counter: String(verification.authenticationInfo?.newCounter ?? 0), lastUsedAt: new Date() } as any).where(eq(superAdminCredentials.id, cred.id) as any);
        delete (app as any)._webauthnAuthChallenge[user.id];
        return reply.send({ success: true, data: { verified: true } });
      }
      return reply.status(400).send({ success: false, error: { code: 'VERIFICATION_FAILED' } });
    } catch (err: any) { return reply.status(400).send({ success: false, error: { code: 'VERIFICATION_ERROR', message: err.message } }); }
  });
}
