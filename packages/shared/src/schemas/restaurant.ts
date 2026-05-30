import { z } from 'zod';

const nepaliPhoneRegex = /^(\+977[-\s]?)?(9[78][0-9])\d{7}$/;

export const restaurantOnboardingSchema = z.object({
  name: z.string().min(3, 'Restaurant name must be at least 3 characters').max(100),
  contactNumber: z
    .string()
    .regex(nepaliPhoneRegex, 'Invalid Nepali phone number')
    .or(z.string().min(7, 'Invalid contact number')),
  address: z.string().min(5, 'Address must be at least 5 characters').max(500),
  slug: z
    .string()
    .min(3, 'Slug must be at least 3 characters')
    .max(50)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be lowercase alphanumeric with hyphens'),
  category: z.string().optional(),
  description: z.string().max(2000).optional(),
  vatPercentage: z.number().min(0).max(100).default(13),
  serviceChargePercentage: z.number().min(0).max(100).default(10),
  taxPercentage: z.number().min(0).max(100).default(0),
  packageType: z.enum(['monthly', 'three_month', 'six_month']),
});

export const restaurantUpdateSchema = restaurantOnboardingSchema
  .omit({ packageType: true, slug: true })
  .partial();

export type RestaurantOnboardingInput = z.infer<typeof restaurantOnboardingSchema>;
export type RestaurantUpdateInput = z.infer<typeof restaurantUpdateSchema>;
