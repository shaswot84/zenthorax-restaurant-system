import type { FastifyInstance } from 'fastify';
import type { Env } from '../config/env';
import { createAuthMiddleware } from '../middleware/auth';

export async function authRoutes(app: FastifyInstance, env: Env) {
  const auth = createAuthMiddleware(env);

  // GET /api/auth/me — Get current user profile
  app.get('/api/auth/me', { preHandler: auth }, async (req, reply) => {
    const { user } = req;
    return reply.send({
      success: true,
      data: {
        id: user!.id,
        email: user!.email,
        role: user!.role,
      },
    });
  });

  // POST /api/auth/kitchen/request-access — Kitchen staff requests restaurant access
  app.post(
    '/api/auth/kitchen/request-access',
    { preHandler: auth },
    async (req, reply) => {
      // TODO: Implement in Phase 7
      return reply.status(501).send({
        success: false,
        error: { code: 'NOT_IMPLEMENTED', message: 'Coming in Phase 7' },
      });
    },
  );
}
