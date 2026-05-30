export interface AuditLog {
  id: string;
  actorId: string | null;
  restaurantId: string | null;
  action: string;
  targetType: string | null;
  targetId: string | null;
  oldValue: Record<string, unknown> | null;
  newValue: Record<string, unknown> | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: Date;
}
