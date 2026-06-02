import { z } from 'zod';

export const menuCategorySchema = z.object({
  name: z.string().trim().min(1, 'Category name is required').max(100, 'Max 100 characters'),
  sortOrder: z.number().int().min(0).optional(),
});

export const menuCategoryUpdateSchema = menuCategorySchema.partial();

export const nutritionInfoSchema = z.object({
  calories: z.number().min(0).nullable().optional(),
  protein: z.number().min(0).nullable().optional(),
  carbs: z.number().min(0).nullable().optional(),
  fat: z.number().min(0).nullable().optional(),
}).optional().nullable();

export const addonSchema = z.object({
  name: z.string().trim().min(1, 'Add-on name is required').max(100),
  price: z.number().min(0, 'Add-on price cannot be negative'),
});

export const menuItemSchema = z.object({
  categoryId: z.string().min(1, 'Category is required'),
  name: z.string().trim().min(1, 'Item name is required').max(200, 'Max 200 characters'),
  description: z.string().max(2000).optional().nullable(),
  price: z.number().positive('Price must be greater than 0'),
  isAvailable: z.boolean().default(true),
  imageUrl: z.string().nullable().optional(),
  nutritionInfo: nutritionInfoSchema,
  addons: z.array(addonSchema).optional(),
});

export const menuItemUpdateSchema = menuItemSchema.partial();

export type MenuCategoryInput = z.infer<typeof menuCategorySchema>;
export type MenuCategoryUpdateInput = z.infer<typeof menuCategoryUpdateSchema>;
export type MenuItemInput = z.infer<typeof menuItemSchema>;
export type MenuItemUpdateInput = z.infer<typeof menuItemUpdateSchema>;
export type AddonInput = z.infer<typeof addonSchema>;
