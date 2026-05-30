import { z } from 'zod';
import { ROLES } from '../constants/roles';

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export const signUpSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  fullName: z.string().min(2, 'Name must be at least 2 characters'),
  role: z.enum([ROLES.RESTAURANT_MANAGER, ROLES.KITCHEN_STAFF]),
});

export const kitchenAccessRequestSchema = z.object({
  restaurantId: z.string().uuid('Invalid restaurant ID'),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type SignUpInput = z.infer<typeof signUpSchema>;
export type KitchenAccessRequestInput = z.infer<typeof kitchenAccessRequestSchema>;
