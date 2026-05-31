import type { FastifyInstance } from 'fastify';
import type { Env } from '../config/env';
import type { Database } from '@zenthorax/database';
import { users, kitchenStaff as kitchenStaffTable } from '@zenthorax/database/schema';
import { createAuthMiddleware } from '../middleware/auth';
import { createClient } from '@supabase/supabase-js';

interface AuthDI {
  db: Database;
  env: Env;
}

export async function authRoutes(app: FastifyInstance, di: AuthDI) {
  const { db, env } = di;
  const auth = createAuthMiddleware(env);
  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

  // ---------------------------------------------------------------------------
  // GET /api/auth/me — Get current user + restaurant info
  // ---------------------------------------------------------------------------
  app.get('/api/auth/me', { preHandler: auth }, async (req, reply) => {
    const { user } = req;

    // Fetch full user profile from our database
    const userRecord = await db.query.users.findFirst({
      where: (u: any, { eq }: any) => eq(u.id, user!.id),
    });

    // If user is a restaurant manager, fetch their restaurant
    let restaurant = null;
    if (user!.role === 'restaurant_manager') {
      restaurant = await db.query.restaurants.findFirst({
        where: (r: any, { eq }: any) => eq(r.ownerId, user!.id),
      });
    }

    // If kitchen staff, fetch their staff record
    let kitchenStaffRecord = null;
    if (user!.role === 'kitchen_staff') {
      kitchenStaffRecord = await db.query.kitchenStaff.findFirst({
        where: (ks: any, { eq, and }: any) =>
          and(eq(ks.userId, user!.id), eq(ks.isApproved, true)),
      });
    }

    return reply.send({
      success: true,
      data: {
        id: user!.id,
        email: user!.email,
        role: user!.role,
        fullName: userRecord?.fullName ?? null,
        avatarUrl: userRecord?.avatarUrl ?? null,
        restaurant: restaurant
          ? {
              id: restaurant.id,
              name: restaurant.name,
              slug: restaurant.slug,
              status: restaurant.status,
            }
          : null,
        kitchenStaff: kitchenStaffRecord
          ? {
              id: kitchenStaffRecord.id,
              restaurantId: kitchenStaffRecord.restaurantId,
              isApproved: kitchenStaffRecord.isApproved,
            }
          : null,
      },
    });
  });

  // ---------------------------------------------------------------------------
  // POST /api/auth/sync — Sync user from Supabase Auth to public.users
  // Called by frontend after Google OAuth signup to ensure user record exists.
  // The DB trigger handles this automatically, but this is a safety net.
  // ---------------------------------------------------------------------------
  app.post('/api/auth/sync', { preHandler: auth }, async (req, reply) => {
    const supabaseUser = req.user!;

    // Check if user already exists in our database
    const existing = await db.query.users.findFirst({
      where: (u: any, { eq }: any) => eq(u.id, supabaseUser.id),
    });

    if (existing) {
      return reply.send({
        success: true,
        data: { id: existing.id, role: existing.role, created: false },
      });
    }

    // Create user record (fallback if trigger didn't fire)
    await db
      .insert(users)
      .values({
        id: supabaseUser.id,
        email: supabaseUser.email,
        role: 'restaurant_manager' as any,
      });

    return reply.status(201).send({
      success: true,
      data: { id: supabaseUser.id, role: 'restaurant_manager', created: true },
    });
  });

  // ---------------------------------------------------------------------------
  // POST /api/auth/kitchen/request-access — Kitchen staff requests access
  // ---------------------------------------------------------------------------
  app.post(
    '/api/auth/kitchen/request-access',
    { preHandler: auth },
    async (req, reply) => {
      const user = req.user!;
      const { restaurantId } = req.body as { restaurantId?: string };

      if (!restaurantId) {
        return reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: 'restaurantId is required.' } });
      }

      // Check restaurant exists
      const restaurant = await db.query.restaurants.findFirst({
        where: (r: any, { eq }: any) => eq(r.id, restaurantId),
      });
      if (!restaurant) {
        return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Restaurant not found.' } });
      }

      // Check if already requested
      const existing = await db.query.kitchenStaff.findFirst({
        where: (ks: any, { eq, and }: any) =>
          and(eq(ks.userId, user.id), eq(ks.restaurantId, restaurantId)),
      });

      if (existing) {
        return reply.send({
          success: true,
          data: { id: existing.id, isApproved: existing.isApproved, status: existing.isApproved ? 'approved' : 'pending' },
        });
      }

      // Create request
      const newId = crypto.randomUUID();
      await db.insert(kitchenStaffTable).values({
        id: newId,
        userId: user.id,
        restaurantId,
        isApproved: false,
      });

      return reply.status(201).send({ success: true, data: { id: newId, isApproved: false, status: 'pending' } });
    },
  );
}
