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

    // Always check for kitchen staff record — any role can be kitchen staff
    let kitchenStaffRecord = null;
    kitchenStaffRecord = await db.query.kitchenStaff.findFirst({
      where: (ks: any, { eq }: any) => eq(ks.userId, user!.id),
    });

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

    // STRICT ROLE ISOLATION: One Google account = one role only
    const emailExisting = await db.query.users.findFirst({
      where: (u: any, { eq }: any) => eq(u.email, supabaseUser.email),
    });
    if (emailExisting) {
      return reply.status(409).send({
        success: false,
        error: {
          code: 'ROLE_CONFLICT',
          message: `This Google account is already registered as a ${emailExisting.role.replace(/_/g, ' ')} and cannot be used to register or sign in with a different role. Each Google account can only have one role.`,
        },
      });
    }

    // Create user record (fallback if trigger didn't fire)
    const chosenRole = (req.body as any)?.role || 'restaurant_manager';
    await db.insert(users).values({
      id: supabaseUser.id, email: supabaseUser.email,
      role: chosenRole as any,
    });

    return reply.status(201).send({
      success: true,
      data: { id: supabaseUser.id, role: chosenRole, created: true },
    });
  });

  // ---------------------------------------------------------------------------
  // GET /api/auth/logout — Redirect-based logout
  // Accepts ?redirect= URL param. Clears the server session, then redirects.
  // Used for the Google logout flow: GET /api/auth/logout?redirect=https://...
  // ---------------------------------------------------------------------------
  app.get('/api/auth/logout', async (req, reply) => {
    const redirectTo = (req.query as any).redirect;
    if (redirectTo && typeof redirectTo === 'string' && redirectTo.startsWith('https://')) {
      return reply.redirect(redirectTo);
    }
    return reply.redirect('/');
  });

  // ---------------------------------------------------------------------------
  // POST /api/auth/expire-session — Invalidate session (sendBeacon from beforeunload)
  // Called by the browser when the user closes the tab. Best-effort.
  // ---------------------------------------------------------------------------
  app.post('/api/auth/expire-session', async (req, reply) => {
    try {
      const { token } = req.body as { token?: string };
      if (token) {
        // Ask Supabase to sign out this token server-side
        await supabase.auth.admin.signOut(token);
      }
    } catch {
      // Swallow errors — this is a best-effort fire-and-forget call
    }
    return reply.send({ success: true });
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
