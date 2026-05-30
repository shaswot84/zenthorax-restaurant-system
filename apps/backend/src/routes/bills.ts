import type { FastifyInstance } from 'fastify';
import type { Env } from '../config/env';

export async function billRoutes(app: FastifyInstance, _env: Env) {
  // POST /api/bills/request — Anonymous: customer requests bill
  app.post('/api/bills/request', async (req, reply) => {
    // TODO: Implement in Phase 8
    return reply.status(501).send({
      success: false,
      error: { code: 'NOT_IMPLEMENTED', message: 'Coming in Phase 8' },
    });
  });

  // GET /api/bills/:id/public — Customer view of their bill
  app.get('/api/bills/:id/public', async (req, reply) => {
    // TODO: Implement in Phase 8
    return reply.status(501).send({
      success: false,
      error: { code: 'NOT_IMPLEMENTED', message: 'Coming in Phase 8' },
    });
  });
}
