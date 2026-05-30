import { z } from 'zod';

export const cartItemSchema = z.object({
  menuItemId: z.string().uuid('Invalid menu item ID'),
  quantity: z.number().int().min(1, 'Quantity must be at least 1').max(99),
});

export const placeOrderSchema = z.object({
  sessionToken: z.string().uuid('Invalid session token'),
  items: z.array(cartItemSchema).min(1, 'Cart cannot be empty'),
  notes: z.string().max(500).optional(),
});

export const updateOrderStatusSchema = z.object({
  status: z.enum(['received', 'preparing', 'ready']),
});

export type CartItemInput = z.infer<typeof cartItemSchema>;
export type PlaceOrderInput = z.infer<typeof placeOrderSchema>;
export type UpdateOrderStatusInput = z.infer<typeof updateOrderStatusSchema>;
