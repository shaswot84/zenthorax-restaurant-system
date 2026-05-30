import type { FastifyRequest, FastifyReply } from 'fastify';

/**
 * Generic error response helper.
 */
export function sendError(
  reply: FastifyReply,
  statusCode: number,
  code: string,
  message: string,
  details?: Record<string, unknown>,
) {
  return reply.status(statusCode).send({
    success: false,
    error: { code, message, details },
  });
}

/**
 * Generic success response helper.
 */
export function sendSuccess<T>(reply: FastifyReply, data: T, statusCode = 200) {
  return reply.status(statusCode).send({
    success: true,
    data,
  });
}

/**
 * Paginated success response helper.
 */
export function sendPaginated<T>(
  reply: FastifyReply,
  items: T[],
  total: number,
  cursor: string | null,
  hasMore: boolean,
) {
  return reply.status(200).send({
    success: true,
    data: items,
    meta: { cursor, hasMore, total },
  });
}

/**
 * Extract restaurant ID from route params and validate ownership.
 * Returns 403 if the authenticated user does not own or staff the restaurant.
 */
export async function validateRestaurantAccess(
  req: FastifyRequest,
  reply: FastifyReply,
  db: any,
  restaurantId: string,
): Promise<boolean> {
  if (!req.user) {
    sendError(reply, 401, 'UNAUTHORIZED', 'Authentication required');
    return false;
  }

  // Super admin can access any restaurant
  if (req.user.role === 'super_admin') return true;

  // Check if user is the restaurant owner
  const restaurant = await db.query.restaurants.findFirst({
    where: (r: any, { eq }: any) => eq(r.id, restaurantId),
    columns: { ownerId: true },
  });

  if (!restaurant) {
    sendError(reply, 404, 'NOT_FOUND', 'Restaurant not found');
    return false;
  }

  if (restaurant.ownerId === req.user.id) return true;

  // Check if user is approved kitchen staff
  const staffRecord = await db.query.kitchenStaff.findFirst({
    where: (ks: any, { eq, and }: any) =>
      and(eq(ks.userId, req.user!.id), eq(ks.restaurantId, restaurantId), eq(ks.isApproved, true)),
  });

  if (staffRecord) return true;

  sendError(reply, 403, 'FORBIDDEN', 'You do not have access to this restaurant');
  return false;
}
