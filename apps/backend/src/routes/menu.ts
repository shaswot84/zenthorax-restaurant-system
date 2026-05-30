import type { FastifyInstance } from 'fastify';
import type { Env } from '../config/env';
import { createAuthMiddleware } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { ROLES } from '@zenthorax/shared';

export async function menuRoutes(app: FastifyInstance, env: Env) {
  const auth = createAuthMiddleware(env);

  // GET /api/restaurants/:id/menu — Public: get full menu (cached)
  app.get('/api/restaurants/:id/menu', async (req, reply) => {
    // TODO: Implement in Phase 4
    return reply.status(501).send({
      success: false,
      error: { code: 'NOT_IMPLEMENTED', message: 'Coming in Phase 4' },
    });
  });

  // POST /api/restaurants/:id/menu-items — Create menu item
  app.post(
    '/api/restaurants/:id/menu-items',
    { preHandler: [auth, requireRole(ROLES.RESTAURANT_MANAGER)] },
    async (req, reply) => {
      // TODO: Implement in Phase 4
      return reply.status(501).send({
        success: false,
        error: { code: 'NOT_IMPLEMENTED', message: 'Coming in Phase 4' },
      });
    },
  );
}
