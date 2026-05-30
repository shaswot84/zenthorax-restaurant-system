import type { FastifyInstance } from 'fastify';
import type { Database } from '@zenthorax/database';
import type { Env } from '../config/env';
import { createAuthMiddleware } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { ROLES, SUBSCRIPTION_PACKAGES } from '@zenthorax/shared';
import { restaurants } from '@zenthorax/database/schema';
import { subscriptions } from '@zenthorax/database/schema';
import { subscriptionPackages } from '@zenthorax/database/schema';
import { eq } from 'drizzle-orm';

interface RestaurantDI {
  db: Database;
  env: Env;
}

export async function restaurantRoutes(app: FastifyInstance, di: RestaurantDI) {
  const { db } = di;
  const auth = createAuthMiddleware(di.env);

  // ---------------------------------------------------------------------------
  // GET /api/restaurants/check-slug/:slug — Check if slug is available
  // ---------------------------------------------------------------------------
  app.get('/api/restaurants/check-slug/:slug', async (req, reply) => {
    const { slug } = req.params as { slug: string };

    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
      return reply.send({ success: true, data: { available: false, reason: 'Invalid slug format. Use lowercase letters, numbers, and hyphens.' } });
    }

    const existing = await db.query.restaurants.findFirst({
      where: (r: any, { eq }: any) => eq(r.slug, slug),
    });

    return reply.send({ success: true, data: { available: !existing } });
  });

  // ---------------------------------------------------------------------------
  // POST /api/restaurants — Create restaurant (onboarding)
  // ---------------------------------------------------------------------------
  app.post('/api/restaurants', { preHandler: auth }, async (req, reply) => {
    const user = req.user!;
    const body = req.body as any;

    // Validate required fields
    const { name, slug, contactNumber, address, packageType } = body;
    if (!name || !slug || !contactNumber || !address || !packageType) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Missing required fields: name, slug, contactNumber, address, packageType' },
      });
    }

    // Validate slug
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Invalid slug format.' },
      });
    }

    // Check slug uniqueness
    const slugExists = await db.query.restaurants.findFirst({
      where: (r: any, { eq }: any) => eq(r.slug, slug),
    });
    if (slugExists) {
      return reply.status(409).send({
        success: false,
        error: { code: 'SLUG_TAKEN', message: 'This URL slug is already taken.' },
      });
    }

    // Check user doesn't already have a restaurant
    const existingRestaurant = await db.query.restaurants.findFirst({
      where: (r: any, { eq }: any) => eq(r.ownerId, user.id),
    });
    if (existingRestaurant) {
      return reply.status(409).send({
        success: false,
        error: { code: 'ALREADY_EXISTS', message: 'You already have a restaurant.' },
      });
    }

    // Validate package type — map frontend keys to subscription constants
    const PACKAGE_MAP: Record<string, keyof typeof SUBSCRIPTION_PACKAGES> = {
      'monthly': 'MONTHLY',
      '3-month': 'THREE_MONTH',
      '6-month': 'SIX_MONTH',
    };
    const pkgKey = PACKAGE_MAP[packageType];
    const pkg = pkgKey ? SUBSCRIPTION_PACKAGES[pkgKey] : undefined;
    if (!pkg) {
      return reply.status(400).send({
        success: false,
        error: { code: 'INVALID_PACKAGE', message: 'Invalid subscription package.' },
      });
    }

    // Create restaurant
    const restaurantId = crypto.randomUUID();
    await db.insert(restaurants).values({
      id: restaurantId,
      ownerId: user.id,
      name,
      slug,
      contactNumber,
      address,
      category: body.category ?? null,
      description: body.description ?? null,
      vatPercentage: body.vatPercentage ?? 13,
      serviceChargePercentage: body.serviceChargePercentage ?? 10,
      taxPercentage: body.taxPercentage ?? 0,
    });

    // Find the subscription package in DB
    const dbPkg = await db.query.subscriptionPackages.findFirst({
      where: (sp: any, { eq }: any) => eq(sp.durationMonths, pkg.durationMonths),
    });

    // Create subscription request
    await db.insert(subscriptions).values({
      restaurantId,
      packageId: dbPkg?.id ?? 'monthly',
      status: 'pending',
    });

    return reply.status(201).send({
      success: true,
      data: {
        id: restaurantId,
        name,
        slug,
        status: 'pending_approval',
        subscriptionStatus: 'pending',
      },
    });
  });

  // ---------------------------------------------------------------------------
  // GET /api/restaurants/mine — Get current user's restaurant
  // ---------------------------------------------------------------------------
  app.get('/api/restaurants/mine', { preHandler: auth }, async (req, reply) => {
    const user = req.user!;

    const restaurant = await db.query.restaurants.findFirst({
      where: (r: any, { eq }: any) => eq(r.ownerId, user.id),
    });

    if (!restaurant) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'No restaurant found for your account.' },
      });
    }

    // Get subscription info
    const sub = await db.query.subscriptions.findFirst({
      where: (s: any, { eq, and }: any) =>
        and(eq(s.restaurantId, restaurant.id), eq(s.status, 'pending')),
    });
    const activeSub = !sub
      ? await db.query.subscriptions.findFirst({
          where: (s: any, { eq, and }: any) =>
            and(eq(s.restaurantId, restaurant.id), eq(s.status, 'active')),
        })
      : null;

    return reply.send({
      success: true,
      data: {
        ...restaurant,
        subscription: sub ?? activeSub ?? null,
      },
    });
  });

  // ---------------------------------------------------------------------------
  // GET /api/restaurants/:id — Get restaurant details (owner only)
  // ---------------------------------------------------------------------------
  app.get(
    '/api/restaurants/:id',
    { preHandler: [auth, requireRole(ROLES.RESTAURANT_MANAGER)] },
    async (req, reply) => {
      const user = req.user!;
      const { id } = req.params as { id: string };

      const restaurant = await db.query.restaurants.findFirst({
        where: (r: any, { eq }: any) => eq(r.id, id),
      });

      if (!restaurant) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Restaurant not found.' },
        });
      }

      if (restaurant.ownerId !== user.id && user.role !== 'super_admin') {
        return reply.status(403).send({
          success: false,
          error: { code: 'FORBIDDEN', message: 'You do not own this restaurant.' },
        });
      }

      return reply.send({ success: true, data: restaurant });
    },
  );

  // ---------------------------------------------------------------------------
  // PATCH /api/restaurants/:id — Update restaurant (owner only)
  // ---------------------------------------------------------------------------
  app.patch(
    '/api/restaurants/:id',
    { preHandler: [auth, requireRole(ROLES.RESTAURANT_MANAGER)] },
    async (req, reply) => {
      const user = req.user!;
      const { id } = req.params as { id: string };
      const body = req.body as any;

      const restaurant = await db.query.restaurants.findFirst({
        where: (r: any, { eq }: any) => eq(r.id, id),
      });

      if (!restaurant) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Restaurant not found.' },
        });
      }

      if (restaurant.ownerId !== user.id) {
        return reply.status(403).send({
          success: false,
          error: { code: 'FORBIDDEN', message: 'You do not own this restaurant.' },
        });
      }

      // Build update object (only allowed fields)
      const updates: Record<string, any> = {};
      const allowedFields = [
        'name', 'contactNumber', 'address', 'category', 'description',
        'vatPercentage', 'serviceChargePercentage', 'taxPercentage',
      ];
      for (const field of allowedFields) {
        if (body[field] !== undefined) {
          updates[field] = body[field];
        }
      }

      if (Object.keys(updates).length === 0) {
        return reply.status(400).send({
          success: false,
          error: { code: 'NO_CHANGES', message: 'No valid fields to update.' },
        });
      }

      await db
        .update(restaurants)
        .set(updates)
        .where(eq(restaurants.id, id) as any);

      return reply.send({ success: true, data: { id, ...updates } });
    },
  );

  // ---------------------------------------------------------------------------
  // GET /api/restaurants/by-slug/:slug/public — Public profile (QR menu)
  // ---------------------------------------------------------------------------
  app.get('/api/restaurants/by-slug/:slug/public', async (req, reply) => {
    const { slug } = req.params as { slug: string };

    const restaurant = await db.query.restaurants.findFirst({
      where: (r: any, { eq, and }: any) =>
        and(eq(r.slug, slug), eq(r.status, 'active')),
    });

    if (!restaurant) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Restaurant not found.' },
      });
    }

    return reply.send({
      success: true,
      data: {
        id: restaurant.id,
        name: restaurant.name,
        slug: restaurant.slug,
        contactNumber: restaurant.contactNumber,
        address: restaurant.address,
        description: restaurant.description,
        logoUrl: restaurant.logoUrl,
        vatPercentage: restaurant.vatPercentage,
        serviceChargePercentage: restaurant.serviceChargePercentage,
        taxPercentage: restaurant.taxPercentage,
      },
    });
  });
}
