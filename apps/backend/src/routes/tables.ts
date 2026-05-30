import type { FastifyInstance } from 'fastify';
import type { Env } from '../config/env';
import { createAuthMiddleware } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { ROLES } from '@zenthorax/shared';

export async function tableRoutes(app: FastifyInstance, env: Env) {
  const auth = createAuthMiddleware(env);

  // GET /api/tables/validate — Public: validate QR scan (slug + table_code)
  app.get('/api/tables/validate', async (req, reply) => {
    // TODO: Implement in Phase 5
    return reply.status(501).send({
      success: false,
      error: { code: 'NOT_IMPLEMENTED', message: 'Coming in Phase 5' },
    });
  });

  // GET /api/restaurants/:id/tables — List tables
  app.get(
    '/api/restaurants/:id/tables',
    { preHandler: [auth, requireRole(ROLES.RESTAURANT_MANAGER)] },
    async (req, reply) => {
      // TODO: Implement in Phase 5
      return reply.status(501).send({
        success: false,
        error: { code: 'NOT_IMPLEMENTED', message: 'Coming in Phase 5' },
      });
    },
  );
}
