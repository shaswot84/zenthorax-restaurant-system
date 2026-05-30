import { z } from 'zod';

export const createTableSchema = z.object({
  tableNumber: z.string().min(1, 'Table number is required').max(20),
});

export const updateTableSchema = z.object({
  tableNumber: z.string().min(1, 'Table number is required').max(20).optional(),
  isActive: z.boolean().optional(),
});

export const validateTableQuerySchema = z.object({
  slug: z.string().min(1),
  code: z.string().uuid('Invalid table code'),
});

export type CreateTableInput = z.infer<typeof createTableSchema>;
export type UpdateTableInput = z.infer<typeof updateTableSchema>;
export type ValidateTableQuery = z.infer<typeof validateTableQuerySchema>;
