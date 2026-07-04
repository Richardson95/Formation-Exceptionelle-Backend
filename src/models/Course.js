import mongoose from 'mongoose';
import { baseSchemaOptions } from './_shared.js';
import {
  COURSE_CATEGORIES,
  COURSE_LEVELS,
  COURSE_LANGUAGES,
  LECTURE_TYPES,
  COURSE_STATUS,
} from '../constants.js';

const videoAssetSchema = new mongoose.Schema(
  {
    assetId: String,
    source: { type: String, enum: ['upload', 'url'], default: 'upload' },
    status: { type: String, enum: ['processing', 'ready'], default: 'processing' },
    originalName: String,
    size: Number,
    duration: Number,
    durationLabel: String,
    thumbnail: String,
    playbackUrl: String,
    embedUrl: String, // Bunny iframe player URL (persisted so playback survives reloads)
  },
  { _id: false }
);

const lectureSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    title: { type: String, required: true },
    duration: { type: String, default: '' },
    type: { type: String, enum: LECTURE_TYPES, default: 'video' },
    preview: { type: Boolean, default: false },
    videoUrl: { type: String, default: '' },
    videoAsset: { type: videoAssetSchema, default: null },
  },
  { _id: false }
);

const sectionSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    title: { type: String, required: true },
    duration: { type: String, default: '' },
    lectures: { type: [lectureSchema], default: [] },
  },
  { _id: false }
);

const instructorSummarySchema = new mongoose.Schema(
  {
    id: String,
    name: String,
    avatar: { type: String, default: null },
    rating: { type: Number, default: 0 },
    students: { type: Number, default: 0 },
  },
  { _id: false }
);

const courseSchema = new mongoose.Schema(
  {
    // String id so the seed can use semantic ids (c001…); API-created courses
    // default to an ObjectId hex string. Always serialized as `id`.
    _id: { type: String, default: () => new mongoose.Types.ObjectId().toString() },
    title: { type: String, required: true, trim: true, index: true },
    subtitle: { type: String, default: '' },
    description: { type: String, default: '' },
    instructor: { type: instructorSummarySchema, default: () => ({}) },
    instructorId: { type: String, index: true },
    category: { type: String, enum: COURSE_CATEGORIES, index: true },
    subcategory: { type: String, default: '' },
    level: { type: String, enum: COURSE_LEVELS, default: 'All Levels', index: true },
    language: { type: String, enum: COURSE_LANGUAGES, default: 'English' },
    price: { type: Number, default: 0, min: 0 },
    originalPrice: { type: Number, default: 0, min: 0 },
    currency: { type: String, default: 'NGN' },
    thumbnail: { type: String, default: '' },
    previewVideo: { type: String, default: '' },
    rating: { type: Number, default: 0 },
    reviewCount: { type: Number, default: 0 },
    enrolledCount: { type: Number, default: 0 },
    duration: { type: String, default: '' },
    lectureCount: { type: Number, default: 0 },
    lastUpdated: { type: String, default: () => new Date().toISOString().slice(0, 10) },
    certificate: { type: Boolean, default: true },
    tags: { type: [String], default: [] },
    requirements: { type: [String], default: [] },
    objectives: { type: [String], default: [] },
    sections: { type: [sectionSchema], default: [] },
    isPaid: { type: Boolean, default: true },
    featured: { type: Boolean, default: false, index: true },
    // New courses default to 'pending' moderation; the seed overrides to 'published'.
    status: { type: String, enum: COURSE_STATUS, default: 'pending', index: true },
    submittedAt: { type: Date, default: null },
    rejectionReason: { type: String, default: '' },
  },
  baseSchemaOptions()
);

courseSchema.index({ title: 'text', subtitle: 'text', tags: 'text' });

// Derive isPaid from price; derive lectureCount from the curriculum ONLY when it
// wasn't explicitly provided. Seeded courses store a marketing lectureCount (e.g.
// "40 lectures") alongside a smaller sample curriculum, mirroring the frontend mock;
// instructor-created courses (no count) get it computed from their sections.
courseSchema.pre('save', function deriveCounts(next) {
  if (!this.lectureCount) {
    this.lectureCount = (this.sections || []).reduce(
      (sum, s) => sum + (s.lectures?.length || 0),
      0
    );
  }
  this.isPaid = (this.price || 0) > 0;
  next();
});

const Course = mongoose.model('Course', courseSchema);
export default Course;
