import type { FastifyInstance } from 'fastify';
import type { Env } from '../config/env';
import type { Database } from '@zenthorax/database';
import type { Redis } from 'ioredis';

interface HealthDI {
  db: Database;
  redis?: Redis;
}

export async function healthRoutes(app: FastifyInstance, env: Env, di: HealthDI) {
  app.get('/api/health', async (_req, reply) => {
    return reply.status(200).send({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: env.NODE_ENV,
      flyApp: env.FLY_APP_NAME ?? 'local',
    });
  });

  app.get('/api/health/detailed', async (_req, reply) => {
    const checks: Record<string, { status: string; message?: string }> = {};

    // Database check
    try {
      await di.db.execute('SELECT 1');
      checks.database = { status: 'ok' };
    } catch (err: unknown) {
      checks.database = { status: 'error', message: (err as Error).message };
    }

    // Redis check (if configured)
    try {
      if (di.redis) {
        await di.redis.ping();
        checks.redis = { status: 'ok' };
      } else {
        checks.redis = { status: 'not_configured' };
      }
    } catch (err: unknown) {
      checks.redis = { status: 'error', message: (err as Error).message };
    }

    const allOk = Object.values(checks).every(
      (c) => c.status === 'ok' || c.status === 'not_configured',
    );

    return reply.status(allOk ? 200 : 503).send({
      status: allOk ? 'healthy' : 'degraded',
      checks,
      timestamp: new Date().toISOString(),
    });
  });
}
