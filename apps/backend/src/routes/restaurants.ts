import type { FastifyInstance } from 'fastify';
import type { Env } from '../config/env';
import { createAuthMiddleware } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { ROLES } from '@zenthorax/shared';

export async function restaurantRoutes(app: FastifyInstance, env: Env) {
  const auth = createAuthMiddleware(env);

  // POST /api/restaurants — Create restaurant (onboarding)
  app.post('/api/restaurants', { preHandler: auth }, async (req, reply) => {
    // TODO: Implement in Phase 2
    return reply.status(501).send({
      success: false,
      error: { code: 'NOT_IMPLEMENTED', message: 'Coming in Phase 2' },
    });
  });

  // GET /api/restaurants/:id — Get restaurant details
  app.get(
    '/api/restaurants/:id',
    { preHandler: [auth, requireRole(ROLES.RESTAURANT_MANAGER)] },
    async (req, reply) => {
      // TODO: Implement in Phase 2
      return reply.status(501).send({
        success: false,
        error: { code: 'NOT_IMPLEMENTED', message: 'Coming in Phase 2' },
      });
    },
  );

  // PATCH /api/restaurants/:id — Update restaurant
  app.patch(
    '/api/restaurants/:id',
    { preHandler: [auth, requireRole(ROLES.RESTAURANT_MANAGER)] },
    async (req, reply) => {
      // TODO: Implement in Phase 2
      return reply.status(501).send({
        success: false,
        error: { code: 'NOT_IMPLEMENTED', message: 'Coming in Phase 2' },
      });
    },
  );

  // GET /api/restaurants/:slug/public — Public restaurant profile (for QR menu)
  app.get('/api/restaurants/:slug/public', async (req, reply) => {
    // TODO: Implement in Phase 2
    return reply.status(501).send({
      success: false,
      error: { code: 'NOT_IMPLEMENTED', message: 'Coming in Phase 2' },
    });
  });
}
