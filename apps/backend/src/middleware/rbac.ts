import type { FastifyRequest, FastifyReply } from 'fastify';
import type { Role } from '@zenthorax/shared';
import { ROLES, ROLE_HIERARCHY } from '@zenthorax/shared';

export function requireRole(...roles: Role[]) {
  return async function roleMiddleware(req: FastifyRequest, reply: FastifyReply) {
    if (!req.user) {
      return reply.status(401).send({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
    }

    const hasRole = roles.some((role) => req.user!.role === role);

    if (!hasRole) {
      return reply.status(403).send({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: `Requires one of roles: ${roles.join(', ')}`,
        },
      });
    }
  };
}

export function requireMinRole(minRole: Role) {
  return async function minRoleMiddleware(req: FastifyRequest, reply: FastifyReply) {
    if (!req.user) {
      return reply.status(401).send({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
    }

    const userLevel = ROLE_HIERARCHY[req.user.role] ?? 0;
    const requiredLevel = ROLE_HIERARCHY[minRole] ?? 0;

    if (userLevel < requiredLevel) {
      return reply.status(403).send({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: `Requires at least role: ${minRole}`,
        },
      });
    }
  };
}

export function superAdminOnly() {
  return requireRole(ROLES.SUPER_ADMIN);
}

export function restaurantStaffOnly() {
  return requireRole(ROLES.RESTAURANT_MANAGER, ROLES.KITCHEN_STAFF);
}
