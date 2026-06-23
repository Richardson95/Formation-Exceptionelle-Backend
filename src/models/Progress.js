import mongoose from 'mongoose';
import { baseSchemaOptions } from './_shared.js';

const progressSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, index: true },
    courseId: { type: String, required: true, index: true },
    completedLectures: { type: [String], default: [] },
    percentage: { type: Number, default: 0, min: 0, max: 100 },
    completedAt: { type: Date, default: null },
  },
  baseSchemaOptions()
);

progressSchema.index({ userId: 1, courseId: 1 }, { unique: true });

const Progress = mongoose.model('Progress', progressSchema);
export default Progress;
