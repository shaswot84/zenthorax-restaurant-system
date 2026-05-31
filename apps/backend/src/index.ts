// Node 22+ built-in .env loader — no dependency needed.
// In production (Fly.io), env vars are injected directly; this is a no-op.
try { process.loadEnvFile(); } catch { /* .env file is optional */ }

import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import multipart from '@fastify/multipart';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { loadEnv } from './config/env';
import { createDb } from '@zenthorax/database';
import { Redis } from 'ioredis';
import { healthRoutes } from './routes/health';
import { authRoutes } from './routes/auth';
import { restaurantRoutes } from './routes/restaurants';
import { menuRoutes } from './routes/menu';
import { tableRoutes } from './routes/tables';
import { orderRoutes } from './routes/orders';
import { kitchenRoutes } from './routes/kitchen';
import { billRoutes } from './routes/bills';
import { uploadRoutes } from './routes/upload';
import { subscriptionRoutes } from './routes/subscription';
import { analyticsRoutes } from './routes/analytics';
import { governanceRoutes } from './routes/governance';
import { adminRoutes } from './routes/admin';

async function bootstrap() {
  const env = loadEnv();

  // --- Database ---
  const db = createDb(env.DATABASE_URL);

  // --- Redis (optional) ---
  let redis: Redis | undefined;
  let redisAvailable = false;
  if (env.REDIS_URL) {
    redis = new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: 1,
      lazyConnect: true,
      retryStrategy(times) {
        if (times > 3) return null;
        return Math.min(times * 500, 2000);
      },
      tls: env.REDIS_URL.startsWith('rediss://') ? undefined : {}, // Enable TLS for Upstash
    });
    redis.on('error', (err: Error) => {
      console.warn('Redis connection error (non-fatal):', err.message);
      redisAvailable = false;
    });
    redis.on('connect', () => {
      redisAvailable = true;
    });
    try {
      await redis.connect();
    } catch (err) {
      console.warn('Redis unavailable, continuing without cache:', (err as Error).message);
      redis = undefined;
    }
  }

  // --- Fastify Server ---
  const app = Fastify({
    logger: {
      level: env.LOG_LEVEL,
      transport:
        env.NODE_ENV === 'development'
          ? { target: 'pino-pretty', options: { colorize: true } }
          : undefined,
    },
    requestIdHeader: 'x-request-id',
  });

  // --- DI object passed to route modules ---
  const di = { db, redis, env };

  // --- Plugins ---
  await app.register(cors, {
    origin: [
      'http://localhost:3000',
      'https://zenthorax.com',
      /\.vercel\.app$/,
    ],
    credentials: true,
  });

  await app.register(helmet, {
    contentSecurityPolicy: false,
  });

  await app.register(multipart, {
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  });

  await app.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
    redis: redisAvailable ? redis : undefined,
    keyGenerator: (req) => {
      return req.ip;
    },
    errorResponseBuilder: (_req, context) => ({
      success: false,
      error: {
        code: 'RATE_LIMITED',
        message: `Too many requests. Retry after ${Math.ceil(context.ttl / 1000)} seconds.`,
      },
    }),
  });

  // --- Swagger Docs ---
  if (env.NODE_ENV === 'development') {
    await app.register(swagger, {
      openapi: {
        info: {
          title: 'Zenthorax API',
          version: '0.1.0',
          description: 'QR Menu Ordering System API',
        },
        servers: [{ url: `http://localhost:${env.PORT}` }],
      },
    });
    await app.register(swaggerUi, {
      routePrefix: '/docs',
    });
  }

  // --- Routes ---
  await app.register((instance) => uploadRoutes(instance, di));
  await app.register((instance) => healthRoutes(instance, env, di));
  await app.register((instance) => authRoutes(instance, di));
  await app.register((instance) => restaurantRoutes(instance, di));
  await app.register((instance) => menuRoutes(instance, di));
  await app.register((instance) => tableRoutes(instance, di));
  await app.register((instance) => orderRoutes(instance, di));
  await app.register((instance) => kitchenRoutes(instance, di));
  await app.register((instance) => billRoutes(instance, di));
  await app.register((instance) => subscriptionRoutes(instance, di));
  await app.register((instance) => analyticsRoutes(instance, di));
  await app.register((instance) => governanceRoutes(instance, di));
  await app.register((instance) => adminRoutes(instance, di));

  // --- Global Error Handler ---
  app.setErrorHandler((error: { statusCode?: number; code?: string; message?: string }, _request, reply) => {
    const statusCode = error.statusCode ?? 500;
    const isProduction = env.NODE_ENV === 'production';

    app.log.error(error);

    reply.status(statusCode).send({
      success: false,
      error: {
        code: error.code ?? 'INTERNAL_ERROR',
        message: isProduction && statusCode === 500 ? 'Internal server error' : (error.message ?? 'Unknown error'),
      },
    });
  });

  // --- Graceful Shutdown ---
  const shutdown = async (signal: string) => {
    app.log.info(`Received ${signal}. Shutting down gracefully...`);
    await app.close();
    if (redis) await redis.quit();
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  // --- Start ---
  try {
    await app.listen({ port: env.PORT, host: env.HOST });
    console.log(`🚀 Zenthorax API running at http://${env.HOST}:${env.PORT}`);
    if (env.NODE_ENV === 'development') {
      console.log(`📚 API Docs at http://localhost:${env.PORT}/docs`);
    }
  } catch (err) {
    app.log.fatal(err);
    process.exit(1);
  }
}

bootstrap();
