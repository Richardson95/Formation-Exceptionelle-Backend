import mongoose from 'mongoose';
import { baseSchemaOptions } from './_shared.js';

const certificateSchema = new mongoose.Schema(
  {
    // Display id like 'FE-<COURSEID>-<USERID6>'. Stored as `code`; Mongo _id stays the db id.
    code: { type: String, index: true },
    userId: { type: String, required: true, index: true },
    courseId: { type: String, required: true, index: true },
    userName: { type: String, default: '' },
    courseTitle: { type: String, default: '' },
    issuedAt: { type: Date, default: Date.now },
    pdfUrl: { type: String, default: null },
  },
  baseSchemaOptions()
);

certificateSchema.index({ userId: 1, courseId: 1 }, { unique: true });

const Certificate = mongoose.model('Certificate', certificateSchema);
export default Certificate;
