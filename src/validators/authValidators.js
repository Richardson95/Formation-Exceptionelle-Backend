import { z } from 'zod';
import { APPLICATION_EXPERIENCE } from '../constants.js';

const email = z.string().trim().toLowerCase().email('A valid email is required');
const password = z.string().min(8, 'Password must be at least 8 characters');

export const registerSchema = z.object({
  firstName: z.string().trim().min(1, 'First name is required'),
  lastName: z.string().trim().min(1, 'Last name is required'),
  email,
  phone: z.string().trim().optional().default(''),
  profession: z.string().trim().optional().default(''),
  password,
  // Register UI only ever submits participant; force it server-side regardless of input.
  role: z.any().optional(),
});

export const loginSchema = z.object({
  email,
  password: z.string().min(1, 'Password is required'),
});

export const updateMeSchema = z
  .object({
    firstName: z.string().trim().min(1).optional(),
    lastName: z.string().trim().min(1).optional(),
    avatar: z.string().nullable().optional(),
    bio: z.string().optional(),
    profession: z.string().optional(),
    phone: z.string().optional(),
  })
  .strip();

export const becomeInstructorSchema = z.object({
  title: z.string().trim().min(1, 'Title is required'),
  experience: z.string().trim().min(1, 'Experience is required'),
  courseTopic: z.string().trim().optional().default(''),
  category: z.string().trim().optional().default(''),
  linkedin: z.string().trim().optional().default(''),
  bio: z.string().trim().optional().default(''),
});

export const forgotPasswordSchema = z.object({ email });

export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Token is required'),
  password,
});

export const verifyTokenQuerySchema = z.object({
  token: z.string().min(1, 'Token is required'),
});

// Exported for reuse where experience enum applies.
export const experienceEnum = z.enum(APPLICATION_EXPERIENCE);
