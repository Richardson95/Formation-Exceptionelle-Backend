import mongoose from 'mongoose';
import { baseSchemaOptions } from './_shared.js';

export const INSTRUCTOR_APPLICATION_STATUS = ['pending', 'approved', 'rejected'];

/**
 * A user's request to become an instructor. Created as `pending` on submit and
 * reviewed by an admin — approval promotes the user to the `instructor` role and
 * copies these details into `user.instructorData`.
 */
const instructorApplicationSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, index: true },
    fullName: { type: String, required: true },
    email: { type: String, required: true },
    title: { type: String, required: true },
    experience: { type: String, default: '' },
    courseTopic: { type: String, default: '' },
    category: { type: String, default: '' },
    linkedin: { type: String, default: '' },
    bio: { type: String, default: '' },
    motivation: { type: String, default: '' },
    resumeUrl: { type: String, default: null },
    resumeName: { type: String, default: '' },
    status: { type: String, enum: INSTRUCTOR_APPLICATION_STATUS, default: 'pending', index: true },
    rejectionReason: { type: String, default: '' },
    reviewedAt: { type: Date, default: null },
  },
  baseSchemaOptions()
);

const InstructorApplication = mongoose.model('InstructorApplication', instructorApplicationSchema);
export default InstructorApplication;
