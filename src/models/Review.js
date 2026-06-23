import mongoose from 'mongoose';
import { baseSchemaOptions } from './_shared.js';

const reviewSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, index: true },
    courseId: { type: String, required: true, index: true },
    userName: { type: String, default: '' },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, default: '' },
  },
  baseSchemaOptions()
);

// One review per user per course.
reviewSchema.index({ userId: 1, courseId: 1 }, { unique: true });

const Review = mongoose.model('Review', reviewSchema);
export default Review;
