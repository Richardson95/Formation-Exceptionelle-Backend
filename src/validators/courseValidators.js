import { z } from 'zod';
import {
  COURSE_CATEGORIES,
  COURSE_LEVELS,
  COURSE_LANGUAGES,
  COURSE_SORTS,
  LECTURE_TYPES,
  COURSE_STATUS,
} from '../constants.js';

const lectureSchema = z.object({
  id: z.string(),
  title: z.string().min(1),
  duration: z.string().optional().default(''),
  type: z.enum(LECTURE_TYPES).optional().default('video'),
  preview: z.boolean().optional().default(false),
  videoUrl: z.string().optional().default(''),
  videoAsset: z.any().optional().nullable(),
});

const sectionSchema = z.object({
  id: z.string(),
  title: z.string().min(1),
  duration: z.string().optional().default(''),
  lectures: z.array(lectureSchema).optional().default([]),
});

export const createCourseSchema = z.object({
  title: z.string().trim().min(1, 'Title is required'),
  subtitle: z.string().trim().min(1, 'Subtitle is required'),
  description: z.string().trim().min(1, 'Description is required'),
  category: z.enum(COURSE_CATEGORIES),
  subcategory: z.string().optional().default(''),
  level: z.enum(COURSE_LEVELS).optional().default('All Levels'),
  language: z.enum(COURSE_LANGUAGES).optional().default('English'),
  price: z.number().min(0).optional().default(0),
  originalPrice: z.number().min(0).optional().default(0),
  currency: z.string().optional().default('USD'),
  thumbnail: z.string().optional().default(''),
  previewVideo: z.string().optional().default(''),
  duration: z.string().optional().default(''),
  certificate: z.boolean().optional().default(true),
  tags: z.array(z.string()).optional().default([]),
  requirements: z.array(z.string()).optional().default([]),
  objectives: z.array(z.string()).optional().default([]),
  sections: z.array(sectionSchema).optional().default([]),
  // Only 'draft' (Save Draft) vs anything-else (submit for review) matters at create;
  // the controller forces 'pending' unless 'draft'. Admins set 'published'/'rejected'.
  status: z.enum(COURSE_STATUS).optional(),
  featured: z.boolean().optional(),
});

export const updateCourseSchema = createCourseSchema.partial();

export const listCoursesQuerySchema = z.object({
  q: z.string().optional(),
  category: z.string().optional(),
  level: z.string().optional(),
  sort: z.enum(COURSE_SORTS).optional(),
  status: z.enum(COURSE_STATUS).optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  paginated: z.coerce.boolean().optional(),
});

export const reviewSchema = z.object({
  rating: z.coerce.number().int().min(1).max(5),
  comment: z.string().trim().optional().default(''),
});
