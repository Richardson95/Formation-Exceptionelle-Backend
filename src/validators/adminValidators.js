import { z } from 'zod';
import { ROLES, USER_STATUS, ORDER_STATUS } from '../constants.js';

export const userUpdateSchema = z
  .object({
    role: z.enum(ROLES).optional(),
    status: z.enum(USER_STATUS).optional(),
  })
  .refine((v) => v.role !== undefined || v.status !== undefined, {
    message: 'Provide at least one of role or status',
  });

// Admin course edit — pricing + moderation/feature flags.
export const courseAdminPatchSchema = z
  .object({
    isPaid: z.boolean().optional(),
    price: z.coerce.number().min(0).optional(),
    originalPrice: z.coerce.number().min(0).optional(),
    featured: z.boolean().optional(),
    status: z.enum(['draft', 'published']).optional(),
  })
  .strip();

// Admin job edit — salary + activation/feature flags.
export const jobAdminPatchSchema = z
  .object({
    salary: z
      .object({
        min: z.coerce.number().min(0),
        max: z.coerce.number().min(0),
        currency: z.string().optional().default('NGN'),
        period: z.enum(['monthly', 'yearly', 'hourly']).optional().default('monthly'),
      })
      .optional(),
    isActive: z.boolean().optional(),
    isFeatured: z.boolean().optional(),
  })
  .strip();

export const rejectSchema = z.object({
  reason: z.string().trim().min(1, 'A rejection reason is required'),
});

export const paymentStatusSchema = z.object({
  status: z.enum(ORDER_STATUS),
});

export const usersQuerySchema = z.object({
  q: z.string().optional(),
  role: z.string().optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
});
