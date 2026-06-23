import mongoose from 'mongoose';
import { baseSchemaOptions } from './_shared.js';

const enrollmentSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, index: true },
    courseId: { type: String, required: true, index: true },
    enrolledAt: { type: Date, default: Date.now },
  },
  baseSchemaOptions()
);

enrollmentSchema.index({ userId: 1, courseId: 1 }, { unique: true });

const Enrollment = mongoose.model('Enrollment', enrollmentSchema);
export default Enrollment;
