import type { FastifyInstance } from 'fastify';
import type { Env } from '../config/env';

export async function orderRoutes(app: FastifyInstance, _env: Env) {
  // POST /api/orders — Anonymous: place a new order
  app.post('/api/orders', async (req, reply) => {
    // TODO: Implement in Phase 6
    return reply.status(501).send({
      success: false,
      error: { code: 'NOT_IMPLEMENTED', message: 'Coming in Phase 6' },
    });
  });

  // GET /api/orders/:id — Get order status (customer tracking)
  app.get('/api/orders/:id', async (req, reply) => {
    // TODO: Implement in Phase 6
    return reply.status(501).send({
      success: false,
      error: { code: 'NOT_IMPLEMENTED', message: 'Coming in Phase 6' },
    });
  });
}
