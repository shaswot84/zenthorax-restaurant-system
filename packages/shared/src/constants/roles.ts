export const ROLES = {
  SUPER_ADMIN: 'super_admin',
  RESTAURANT_MANAGER: 'restaurant_manager',
  KITCHEN_STAFF: 'kitchen_staff',
  CUSTOMER: 'customer',
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

export const ROLE_HIERARCHY: Record<Role, number> = {
  super_admin: 100,
  restaurant_manager: 50,
  kitchen_staff: 25,
  customer: 0,
};

export function hasMinRole(userRole: Role, minRole: Role): boolean {
  return (ROLE_HIERARCHY[userRole] ?? 0) >= (ROLE_HIERARCHY[minRole] ?? 0);
}
