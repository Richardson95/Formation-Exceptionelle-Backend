import { z } from 'zod';
import {
  JOB_CATEGORIES,
  JOB_TYPES,
  JOB_LOCATION_TYPES,
  JOB_LEVELS,
  JOB_SORTS,
  SALARY_PERIODS,
  APPLICATION_STATUS,
} from '../constants.js';

const salarySchema = z.object({
  min: z.coerce.number().min(0).optional().default(0),
  max: z.coerce.number().min(0).optional().default(0),
  currency: z.string().optional().default('NGN'),
  period: z.enum(SALARY_PERIODS).optional().default('monthly'),
});

export const createJobSchema = z.object({
  title: z.string().trim().min(1, 'Title is required'),
  company: z.string().trim().min(1, 'Company is required'),
  companyLogo: z.string().nullable().optional(),
  location: z.string().optional().default(''),
  locationType: z.enum(JOB_LOCATION_TYPES).optional().default('On-site'),
  type: z.enum(JOB_TYPES).optional().default('Full-time'),
  category: z.enum(JOB_CATEGORIES),
  salary: salarySchema.optional().default({}),
  experience: z.string().optional().default(''),
  level: z.enum(JOB_LEVELS).optional().default('Mid-level'),
  description: z.string().trim().min(1, 'Description is required'),
  responsibilities: z.array(z.string()).optional().default([]),
  requirements: z.array(z.string()).optional().default([]),
  benefits: z.array(z.string()).optional().default([]),
  skills: z.array(z.string()).optional().default([]),
  deadline: z.string().min(1, 'Deadline is required'),
});

export const updateJobSchema = createJobSchema
  .partial()
  .extend({
    isActive: z.boolean().optional(),
    isFeatured: z.boolean().optional(),
  });

export const listJobsQuerySchema = z.object({
  q: z.string().optional(),
  type: z.string().optional(),
  category: z.string().optional(),
  location: z.string().optional(),
  sort: z.enum(JOB_SORTS).optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  paginated: z.coerce.boolean().optional(),
});

export const applySchema = z.object({
  jobId: z.string().min(1),
  fullName: z.string().trim().min(1, 'Full name is required'),
  email: z.string().trim().toLowerCase().email(),
  phone: z.string().optional().default(''),
  location: z.string().optional().default(''),
  linkedin: z.string().optional().default(''),
  portfolio: z.string().optional().default(''),
  experience: z.string().optional().default(''),
  coverLetter: z.string().trim().min(1, 'Cover letter is required'),
  cvName: z.string().optional().default(''),
  cvUrl: z.string().nullable().optional(),
});

export const applicationStatusSchema = z.object({
  status: z.enum(APPLICATION_STATUS),
});
