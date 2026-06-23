import mongoose from 'mongoose';
import { baseSchemaOptions } from './_shared.js';
import { APPLICATION_STATUS } from '../constants.js';

const applicationSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, index: true },
    jobId: { type: String, required: true, index: true },
    fullName: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String, default: '' },
    location: { type: String, default: '' },
    linkedin: { type: String, default: '' },
    portfolio: { type: String, default: '' },
    experience: { type: String, default: '' },
    coverLetter: { type: String, required: true },
    cvName: { type: String, default: '' },
    cvUrl: { type: String, default: null },
    status: { type: String, enum: APPLICATION_STATUS, default: 'pending', index: true },
    appliedAt: { type: Date, default: Date.now },
    reviewedAt: { type: Date, default: null }, // set when employer/admin changes status
  },
  baseSchemaOptions()
);

// A user applies once per job.
applicationSchema.index({ userId: 1, jobId: 1 }, { unique: true });

const Application = mongoose.model('Application', applicationSchema);
export default Application;
