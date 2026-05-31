import type { FastifyInstance } from 'fastify';
import type { Database } from '@zenthorax/database';
import type { Env } from '../config/env';
import { createAuthMiddleware } from '../middleware/auth';
import { superAdminOnly } from '../middleware/rbac';
import { auditLogs, governanceProposals, governanceVotes, users as usersTable, superAdminCredentials } from '@zenthorax/database/schema';
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

  // GET /api/admin/audit-logs — List with search & filters
  app.get('/api/admin/audit-logs', { preHandler: adminOnly }, async (req, reply) => {
    const { search, action, limit = '50', offset = '0' } = req.query as Record<string, string>;
    const take = Math.min(parseInt(limit) || 50, 100);
    const skip = parseInt(offset) || 0;

    let conditions: any[] = [];
    if (search) {
      const term = `%${search}%`;
      conditions.push(or(like(auditLogs.action, term), like(auditLogs.targetType, term)) as any);
    }
    if (action) conditions.push(eq(auditLogs.action, action) as any);

    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const [total] = await db.select({ count: sql<number>`COUNT(*)` }).from(auditLogs).where(where as any);

    const logs = await db.query.auditLogs.findMany({
      where: where as any, orderBy: [desc(auditLogs.createdAt)], limit: take, offset: skip,
      with: { actor: { columns: { email: true } }, restaurant: { columns: { name: true } } },
    });

    return reply.send({ success: true, data: logs, meta: { total: Number(total?.count ?? 0), limit: take, offset: skip } });
  });

  // ═══════════════════════════════════════════════════════════════
  // GOVERNANCE PROPOSALS
  // ═══════════════════════════════════════════════════════════════

  // GET /api/admin/governance/proposals — List proposals
  app.get('/api/admin/governance/proposals', { preHandler: adminOnly }, async (_req, reply) => {
    const proposals = await db.query.governanceProposals.findMany({
      orderBy: [desc(governanceProposals.createdAt)],
      with: { proposer: { columns: { email: true } }, votes: { with: { voter: { columns: { email: true } } } } },
    });
    return reply.send({ success: true, data: proposals });
  });

  // POST /api/admin/governance/proposals — Create proposal
  app.post('/api/admin/governance/proposals', { preHandler: adminOnly }, async (req, reply) => {
    const { actionType, targetId, reason } = req.body as { actionType?: string; targetId?: string; reason?: string };
    if (!actionType || !reason) return reply.status(400).send({ success: false, error: { code: 'VALIDATION' } });

    // Count super admins to determine required approvals
    const [adminCount] = await db.select({ count: sql<number>`COUNT(*)` }).from(usersTable)
      .where(eq(usersTable.role, 'super_admin' as any) as any);
    const required = Math.max(1, Math.floor(Number(adminCount?.count ?? 1) / 2));

    const id = randomUUID();
    await db.insert(governanceProposals).values({
      id, proposerId: req.user!.id, actionType, targetId: targetId ?? null, reason, requiredApprovals: required,
    } as any);

    return reply.status(201).send({ success: true, data: { id, requiredApprovals: required } });
  });

  // POST /api/admin/governance/proposals/:id/vote — Vote on proposal
  app.post('/api/admin/governance/proposals/:id/vote', { preHandler: adminOnly }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const { vote, reason } = req.body as { vote?: string; reason?: string };
    if (!vote || !['approve', 'reject'].includes(vote)) return reply.status(400).send({ success: false });

    const proposal = await db.query.governanceProposals.findFirst({ where: (p: any, { eq }: any) => eq(p.id, id) });
    if (!proposal || proposal.status !== 'pending') return reply.status(400).send({ success: false, error: { code: 'NOT_PENDING' } });

    // Check not already voted
    const existing = await db.query.governanceVotes.findFirst({
      where: (v: any, { eq, and }: any) => and(eq(v.proposalId, id), eq(v.voterId, req.user!.id)),
    });
    if (existing) return reply.status(409).send({ success: false, error: { code: 'ALREADY_VOTED' } });

    await db.insert(governanceVotes).values({
      id: randomUUID(), proposalId: id, voterId: req.user!.id, vote: vote as any, reason: reason ?? null,
    } as any);

    // Check if threshold reached
    const voteCount = await db.select({ count: sql<number>`COUNT(*)` }).from(governanceVotes)
      .where(and(eq(governanceVotes.proposalId, id), eq(governanceVotes.vote, 'approve' as any)) as any);
    const approvedCount = Number(voteCount[0]?.count ?? 0);

    if (approvedCount >= proposal.requiredApprovals) {
      await db.update(governanceProposals).set({ status: 'approved' as any }).where(eq(governanceProposals.id, id) as any);
    }

    return reply.send({ success: true, data: { approvedCount, required: proposal.requiredApprovals, status: approvedCount >= proposal.requiredApprovals ? 'approved' : 'pending' } });
  });

  // POST /api/admin/governance/proposals/:id/execute — Execute approved proposal
  app.post('/api/admin/governance/proposals/:id/execute', { preHandler: adminOnly }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const proposal = await db.query.governanceProposals.findFirst({ where: (p: any, { eq }: any) => eq(p.id, id) });
    if (!proposal) return reply.status(404).send({ success: false });
    if (proposal.status !== 'approved') return reply.status(400).send({ success: false, error: { code: 'NOT_APPROVED', message: 'Proposal must be approved before execution.' } });

    await db.update(governanceProposals).set({ status: 'executed' as any }).where(eq(governanceProposals.id, id) as any);
    return reply.send({ success: true, data: { status: 'executed' } });
  });

  // ═══════════════════════════════════════════════════════════════
  // WEBAUTHN (stubs — full implementation requires browser API)
  // ═══════════════════════════════════════════════════════════════

  app.post('/api/admin/webauthn/register', { preHandler: adminOnly }, async (req, reply) => {
    const { credentialId, publicKey } = req.body as { credentialId?: string; publicKey?: string };
    if (!credentialId || !publicKey) return reply.status(400).send({ success: false, error: { code: 'VALIDATION' } });

    await db.insert(superAdminCredentials).values({
      id: randomUUID(), userId: req.user!.id, credentialId, publicKey,
    } as any);

    return reply.status(201).send({ success: true, data: { registered: true } });
  });

  app.post('/api/admin/webauthn/verify', { preHandler: adminOnly }, async (_req, reply) => {
    // In production, this would verify a WebAuthn assertion challenge
    return reply.send({ success: true, data: { verified: true, challenge: randomUUID() } });
  });

  // ═══════════════════════════════════════════════════════════════
  // AUDIT LOGS CSV EXPORT
  // ═══════════════════════════════════════════════════════════════

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
    const rows = logs.map(l =>
      `"${l.createdAt}","${l.actor?.email ?? 'System'}","${l.action}","${l.targetType ?? ''}","${l.targetId ?? ''}","${l.restaurant?.name ?? ''}","${l.ipAddress ?? ''}"`
    ).join('\n');

    reply.header('Content-Type', 'text/csv');
    reply.header('Content-Disposition', 'attachment; filename="audit-logs.csv"');
    return reply.send(header + rows);
  });
}
