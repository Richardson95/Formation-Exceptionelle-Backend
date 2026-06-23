import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { baseSchemaOptions } from './_shared.js';
import { ROLES, USER_STATUS } from '../constants.js';
import env from '../config/env.js';

const instructorDataSchema = new mongoose.Schema(
  {
    title: { type: String, default: '' },
    experience: { type: String, default: '' },
    courseTopic: { type: String, default: '' },
    category: { type: String, default: '' },
    linkedin: { type: String, default: '' },
    bio: { type: String, default: '' },
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    password: { type: String, required: true, select: false },
    role: { type: String, enum: ROLES, default: 'participant', index: true },
    avatar: { type: String, default: null },
    bio: { type: String, default: '' },
    profession: { type: String, default: '' },
    phone: { type: String, default: '' },
    enrolledCourses: { type: [String], default: [] },
    completedCourses: { type: [String], default: [] },
    instructorData: { type: instructorDataSchema, default: null },
    status: { type: String, enum: USER_STATUS, default: 'active', index: true },
  },
  // Never leak the password hash, even if it was selected.
  baseSchemaOptions((doc, ret) => {
    delete ret.password;
  })
);

// Computed convenience virtuals (also surfaced to the frontend).
userSchema.virtual('fullName').get(function fullName() {
  return `${this.firstName} ${this.lastName}`.trim();
});

userSchema.pre('save', async function hashPassword(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, env.BCRYPT_ROUNDS);
  next();
});

userSchema.methods.comparePassword = function comparePassword(candidate) {
  return bcrypt.compare(candidate, this.password);
};

/** Safe user object (no password) — what the API returns. */
userSchema.methods.toSafeJSON = function toSafeJSON() {
  return this.toJSON();
};

const User = mongoose.model('User', userSchema);
export default User;
