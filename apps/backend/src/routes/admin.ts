import type { FastifyInstance } from 'fastify';
import type { Env } from '../config/env';
import { createAuthMiddleware } from '../middleware/auth';
import { superAdminOnly } from '../middleware/rbac';

export async function adminRoutes(app: FastifyInstance, env: Env) {
  const auth = createAuthMiddleware(env);

  // All admin routes require super admin
  const adminPreHandler = [auth, superAdminOnly()];

  // GET /api/admin/restaurants — Search & list restaurants
  app.get('/api/admin/restaurants', { preHandler: adminPreHandler }, async (req, reply) => {
    // TODO: Implement in Phase 3
    return reply.status(501).send({
      success: false,
      error: { code: 'NOT_IMPLEMENTED', message: 'Coming in Phase 3' },
    });
  });

  // GET /api/admin/dashboard/stats — Platform overview stats
  app.get('/api/admin/dashboard/stats', { preHandler: adminPreHandler }, async (req, reply) => {
    // TODO: Implement in Phase 3
    return reply.status(501).send({
      success: false,
      error: { code: 'NOT_IMPLEMENTED', message: 'Coming in Phase 3' },
    });
  });

  // GET /api/admin/subscriptions/pending — Pending subscription requests
  app.get(
    '/api/admin/subscriptions/pending',
    { preHandler: adminPreHandler },
    async (req, reply) => {
      // TODO: Implement in Phase 3
      return reply.status(501).send({
        success: false,
        error: { code: 'NOT_IMPLEMENTED', message: 'Coming in Phase 3' },
      });
    },
  );
}
