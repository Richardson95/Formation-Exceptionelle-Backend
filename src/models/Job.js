import mongoose from 'mongoose';
import { baseSchemaOptions } from './_shared.js';
import {
  JOB_CATEGORIES,
  JOB_TYPES,
  JOB_LOCATION_TYPES,
  JOB_LEVELS,
  SALARY_PERIODS,
  JOB_STATUS,
} from '../constants.js';

const salarySchema = new mongoose.Schema(
  {
    min: { type: Number, default: 0 },
    max: { type: Number, default: 0 },
    currency: { type: String, default: 'NGN' },
    period: { type: String, enum: SALARY_PERIODS, default: 'monthly' },
  },
  { _id: false }
);

const jobSchema = new mongoose.Schema(
  {
    // String id so the seed can use semantic ids (j001…); API-created jobs
    // default to an ObjectId hex string. Always serialized as `id`.
    _id: { type: String, default: () => new mongoose.Types.ObjectId().toString() },
    title: { type: String, required: true, trim: true, index: true },
    company: { type: String, required: true, trim: true },
    companyLogo: { type: String, default: null },
    location: { type: String, default: '' },
    locationType: { type: String, enum: JOB_LOCATION_TYPES, default: 'On-site' },
    type: { type: String, enum: JOB_TYPES, default: 'Full-time', index: true },
    category: { type: String, enum: JOB_CATEGORIES, index: true },
    salary: { type: salarySchema, default: () => ({}) },
    experience: { type: String, default: '' },
    level: { type: String, enum: JOB_LEVELS, default: 'Mid-level' },
    description: { type: String, required: true },
    responsibilities: { type: [String], default: [] },
    requirements: { type: [String], default: [] },
    benefits: { type: [String], default: [] },
    skills: { type: [String], default: [] },
    deadline: { type: String, required: true }, // 'YYYY-MM-DD'
    postedAt: { type: String, default: () => new Date().toISOString().slice(0, 10) },
    postedBy: { type: String, index: true },
    applications: { type: Number, default: 0 },
    views: { type: Number, default: 0 },
    // New jobs default to pending/inactive; the seed overrides to approved/active.
    isActive: { type: Boolean, default: false, index: true },
    isFeatured: { type: Boolean, default: false, index: true },
    status: { type: String, enum: JOB_STATUS, default: 'pending', index: true },
    submittedAt: { type: Date, default: null },
    rejectionReason: { type: String, default: '' },
  },
  baseSchemaOptions()
);

jobSchema.index({ title: 'text', company: 'text', skills: 'text' });

const Job = mongoose.model('Job', jobSchema);
export default Job;
