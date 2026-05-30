import { z } from 'zod';

export const menuCategorySchema = z.object({
  name: z.string().min(1, 'Category name is required').max(100),
  sortOrder: z.number().int().min(0).optional(),
});

export const menuCategoryUpdateSchema = menuCategorySchema.partial();

export const nutritionInfoSchema = z
  .object({
    calories: z.number().min(0).nullable().optional(),
    protein: z.number().min(0).nullable().optional(),
    carbs: z.number().min(0).nullable().optional(),
    fat: z.number().min(0).nullable().optional(),
  })
  .optional()
  .nullable();

export const menuItemSchema = z.object({
  categoryId: z.string().uuid('Invalid category ID'),
  name: z.string().min(1, 'Item name is required').max(200),
  description: z.string().max(2000).optional().nullable(),
  price: z.number().positive('Price must be greater than 0'),
  isAvailable: z.boolean().default(true),
  nutritionInfo: nutritionInfoSchema,
});

export const menuItemUpdateSchema = menuItemSchema.partial();

export type MenuCategoryInput = z.infer<typeof menuCategorySchema>;
export type MenuCategoryUpdateInput = z.infer<typeof menuCategoryUpdateSchema>;
export type MenuItemInput = z.infer<typeof menuItemSchema>;
export type MenuItemUpdateInput = z.infer<typeof menuItemUpdateSchema>;
