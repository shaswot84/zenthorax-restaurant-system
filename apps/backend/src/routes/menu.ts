import type { FastifyInstance } from 'fastify';
import type { Database } from '@zenthorax/database';
import type { Env } from '../config/env';
import { createAuthMiddleware } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { ROLES } from '@zenthorax/shared';
import { menuCategories, menuItems, addons } from '@zenthorax/database/schema';
import { eq, and, asc } from 'drizzle-orm';

interface MenuDI {
  db: Database;
  env: Env;
}

export async function menuRoutes(app: FastifyInstance, di: MenuDI) {
  const { db } = di;
  const auth = createAuthMiddleware(di.env);
  const managerOnly = [auth, requireRole(ROLES.RESTAURANT_MANAGER)];

  // Helper: verify restaurant ownership
  async function verifyOwnership(restaurantId: string, userId: string) {
    const r = await db.query.restaurants.findFirst({
      where: (r: any, { eq }: any) => eq(r.id, restaurantId),
      columns: { ownerId: true },
    });
    return r?.ownerId === userId;
  }

  // ---------------------------------------------------------------------------
  // GET /api/restaurants/:id/menu — Public: full menu with categories & items
  // ---------------------------------------------------------------------------
  app.get('/api/restaurants/:id/menu', async (req, reply) => {
    const { id } = req.params as { id: string };

    const cats = await db.query.menuCategories.findMany({
      where: (c: any, { eq }: any) => eq(c.restaurantId, id),
      orderBy: [asc(menuCategories.sortOrder)],
      with: { items: { orderBy: [asc(menuItems.name)], with: { addons: true } } },
    });

    return reply.send({ success: true, data: cats });
  });

  // ---------------------------------------------------------------------------
  // POST /api/restaurants/:id/categories — Create category
  // ---------------------------------------------------------------------------
  app.post('/api/restaurants/:id/categories', { preHandler: managerOnly }, async (req, reply) => {
    const { id } = req.params as { id: string };
    if (!(await verifyOwnership(id, req.user!.id))) {
      return reply.status(403).send({ success: false, error: { code: 'FORBIDDEN', message: 'Not your restaurant.' } });
    }
    const { name } = req.body as { name: string };
    if (!name?.trim()) {
      return reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: 'Name is required.' } });
    }

    const maxSort = await db.query.menuCategories.findMany({
      where: (c: any, { eq }: any) => eq(c.restaurantId, id),
      orderBy: [asc(menuCategories.sortOrder)],
      limit: 100,
    });
    const nextOrder = (maxSort[maxSort.length - 1]?.sortOrder ?? -1) + 1;

    const newCat = { id: crypto.randomUUID(), restaurantId: id, name: name.trim(), sortOrder: nextOrder };
    await db.insert(menuCategories).values(newCat as any);
    return reply.status(201).send({ success: true, data: newCat });
  });

  // ---------------------------------------------------------------------------
  // PATCH /api/restaurants/:id/categories/:catId — Update category
  // ---------------------------------------------------------------------------
  app.patch('/api/restaurants/:id/categories/:catId', { preHandler: managerOnly }, async (req, reply) => {
    const { id, catId } = req.params as { id: string; catId: string };
    if (!(await verifyOwnership(id, req.user!.id))) {
      return reply.status(403).send({ success: false, error: { code: 'FORBIDDEN', message: 'Not your restaurant.' } });
    }
    const { name, sortOrder } = req.body as { name?: string; sortOrder?: number };
    const updates: Record<string, any> = {};
    if (name !== undefined) updates.name = name.trim();
    if (sortOrder !== undefined) updates.sortOrder = sortOrder;
    if (Object.keys(updates).length === 0) {
      return reply.status(400).send({ success: false, error: { code: 'NO_CHANGES' } });
    }
    await db.update(menuCategories).set(updates).where(
      and(eq(menuCategories.id, catId) as any, eq(menuCategories.restaurantId, id) as any) as any,
    );
    return reply.send({ success: true, data: { id: catId, ...updates } });
  });

  // ---------------------------------------------------------------------------
  // DELETE /api/restaurants/:id/categories/:catId — Delete category
  // ---------------------------------------------------------------------------
  app.delete('/api/restaurants/:id/categories/:catId', { preHandler: managerOnly }, async (req, reply) => {
    const { id, catId } = req.params as { id: string; catId: string };
    if (!(await verifyOwnership(id, req.user!.id))) {
      return reply.status(403).send({ success: false, error: { code: 'FORBIDDEN' } });
    }
    await db.delete(menuCategories).where(
      and(eq(menuCategories.id, catId) as any, eq(menuCategories.restaurantId, id) as any) as any,
    );
    return reply.send({ success: true });
  });

  // ---------------------------------------------------------------------------
  // POST /api/restaurants/:id/menu-items — Create menu item
  // ---------------------------------------------------------------------------
  app.post('/api/restaurants/:id/menu-items', { preHandler: managerOnly }, async (req, reply) => {
    const { id } = req.params as { id: string };
    if (!(await verifyOwnership(id, req.user!.id))) {
      return reply.status(403).send({ success: false, error: { code: 'FORBIDDEN' } });
    }
    const { categoryId, name, description, price, nutritionInfo, imageUrl, addons: addonList } = req.body as any;
    if (!categoryId || !name?.trim() || price === undefined) {
      return reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: 'categoryId, name, and price are required.' } });
    }
    if (typeof price !== 'number' || price < 0) {
      return reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: 'Price must be a positive number.' } });
    }

    const item = {
      id: crypto.randomUUID(),
      restaurantId: id,
      categoryId,
      name: name.trim(),
      description: description ?? null,
      price,
      imageUrl: imageUrl ?? null,
      isAvailable: true,
      nutritionInfo: nutritionInfo ?? null,
    };
    await db.insert(menuItems).values(item as any);

    // Create addons if provided
    if (addonList && Array.isArray(addonList)) {
      for (const a of addonList) {
        if (a.name && a.price >= 0) {
          await db.insert(addons).values({
            id: crypto.randomUUID(), menuItemId: item.id, name: a.name, price: a.price,
          });
        }
      }
    }

    return reply.status(201).send({ success: true, data: item });
  });

  // ---------------------------------------------------------------------------
  // PATCH /api/restaurants/:id/menu-items/:itemId — Update menu item
  // ---------------------------------------------------------------------------
  app.patch('/api/restaurants/:id/menu-items/:itemId', { preHandler: managerOnly }, async (req, reply) => {
    const { id, itemId } = req.params as { id: string; itemId: string };
    if (!(await verifyOwnership(id, req.user!.id))) {
      return reply.status(403).send({ success: false, error: { code: 'FORBIDDEN' } });
    }
    const body = req.body as any;
    const updates: Record<string, any> = {};
    const allowed = ['name', 'description', 'price', 'categoryId', 'nutritionInfo', 'imageUrl'];
    for (const f of allowed) if (body[f] !== undefined) updates[f] = body[f];
    if (Object.keys(updates).length === 0 && !body.addons) {
      return reply.status(400).send({ success: false, error: { code: 'NO_CHANGES' } });
    }
    if (Object.keys(updates).length > 0) {
      await db.update(menuItems).set(updates).where(
        and(eq(menuItems.id, itemId) as any, eq(menuItems.restaurantId, id) as any) as any,
      );
    }
    // Replace addons if provided
    if (body.addons && Array.isArray(body.addons)) {
      await db.delete(addons).where(eq(addons.menuItemId, itemId) as any);
      for (const a of body.addons) {
        if (a.name && a.price >= 0) {
          await db.insert(addons).values({
            id: crypto.randomUUID(), menuItemId: itemId, name: a.name, price: a.price,
          });
        }
      }
    }
    return reply.send({ success: true, data: { id: itemId, ...updates } });
  });

  // ---------------------------------------------------------------------------
  // DELETE /api/restaurants/:id/menu-items/:itemId — Delete menu item
  // ---------------------------------------------------------------------------
  app.delete('/api/restaurants/:id/menu-items/:itemId', { preHandler: managerOnly }, async (req, reply) => {
    const { id, itemId } = req.params as { id: string; itemId: string };
    if (!(await verifyOwnership(id, req.user!.id))) {
      return reply.status(403).send({ success: false, error: { code: 'FORBIDDEN' } });
    }
    await db.delete(menuItems).where(
      and(eq(menuItems.id, itemId) as any, eq(menuItems.restaurantId, id) as any) as any,
    );
    return reply.send({ success: true });
  });

  // ---------------------------------------------------------------------------
  // PATCH /api/restaurants/:id/menu-items/:itemId/toggle — Toggle availability
  // ---------------------------------------------------------------------------
  app.patch('/api/restaurants/:id/menu-items/:itemId/toggle', { preHandler: managerOnly }, async (req, reply) => {
    const { id, itemId } = req.params as { id: string; itemId: string };
    if (!(await verifyOwnership(id, req.user!.id))) {
      return reply.status(403).send({ success: false, error: { code: 'FORBIDDEN' } });
    }
    const item = await db.query.menuItems.findFirst({
      where: (i: any, { eq, and }: any) => and(eq(i.id, itemId), eq(i.restaurantId, id)),
    });
    if (!item) return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND' } });

    await db.update(menuItems).set({ isAvailable: !item.isAvailable }).where(
      and(eq(menuItems.id, itemId) as any, eq(menuItems.restaurantId, id) as any) as any,
    );
    return reply.send({ success: true, data: { isAvailable: !item.isAvailable } });
  });
}
