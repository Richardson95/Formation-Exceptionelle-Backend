import crypto from 'crypto';
import asyncHandler from '../utils/asyncHandler.js';
import ApiError from '../utils/ApiError.js';
import { signToken } from '../utils/jwt.js';
import User from '../models/User.js';
import PasswordResetToken from '../models/PasswordResetToken.js';
import env from '../config/env.js';
import { sendWelcomeEmail, sendPasswordResetEmail } from '../services/mailer.js';

const RESET_TTL_MS = 30 * 60 * 1000;
const hashToken = (t) => crypto.createHash('sha256').update(t).digest('hex');

export const register = asyncHandler(async (req, res) => {
  const { firstName, lastName, email, phone, profession, password } = req.body;

  const exists = await User.findOne({ email });
  if (exists) throw ApiError.conflict('An account with this email already exists');

  // Registration always creates a participant regardless of submitted role.
  const user = await User.create({
    firstName,
    lastName,
    email,
    phone,
    profession,
    password,
    role: 'participant',
  });

  sendWelcomeEmail(user).catch(() => {});

  const token = signToken(user);
  res.status(201).json({ user: user.toSafeJSON(), token });
});

export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  // Need the password field (select:false by default).
  const user = await User.findOne({ email }).select('+password');
  if (!user) throw ApiError.unauthorized('Invalid email or password');

  const ok = await user.comparePassword(password);
  if (!ok) throw ApiError.unauthorized('Invalid email or password');

  if (user.status === 'suspended') {
    throw ApiError.forbidden('Your account has been suspended');
  }

  const token = signToken(user);
  res.json({ user: user.toSafeJSON(), token });
});

export const logout = asyncHandler(async (req, res) => {
  // Stateless JWT — client discards the token. No-op server-side.
  res.json({ success: true });
});

export const me = asyncHandler(async (req, res) => {
  res.json({ user: req.user.toSafeJSON() });
});

export const updateMe = asyncHandler(async (req, res) => {
  Object.assign(req.user, req.body);
  await req.user.save();
  res.json({ user: req.user.toSafeJSON() });
});

export const becomeInstructor = asyncHandler(async (req, res) => {
  const user = req.user;
  user.instructorData = { ...req.body };
  // Auto-approve to match the current frontend UX (immediate success).
  if (user.role === 'participant') user.role = 'instructor';
  await user.save();
  res.json({ user: user.toSafeJSON() });
});

export const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;
  const user = await User.findOne({ email });

  // Always respond neutrally — never reveal whether the email is registered.
  if (user) {
    const rawToken = crypto.randomBytes(32).toString('hex');
    await PasswordResetToken.create({
      userId: user.id,
      tokenHash: hashToken(rawToken),
      expiresAt: new Date(Date.now() + RESET_TTL_MS),
    });
    const resetUrl = `${env.CLIENT_ORIGIN}/auth/reset-password?token=${rawToken}`;
    sendPasswordResetEmail(user, resetUrl).catch(() => {});
    if (env.isDev) {
      // eslint-disable-next-line no-console
      console.log(`[auth] Password reset link (dev): ${resetUrl}`);
    }
  }

  res.json({ success: true });
});

export const verifyResetToken = asyncHandler(async (req, res) => {
  const token = req.query.token;
  const record = await PasswordResetToken.findOne({ tokenHash: hashToken(token) });
  if (!record || record.usedAt) return res.json({ valid: false, reason: 'invalid' });
  if (record.expiresAt.getTime() < Date.now()) return res.json({ valid: false, reason: 'expired' });
  res.json({ valid: true });
});

export const resetPassword = asyncHandler(async (req, res) => {
  const { token, password } = req.body;
  const record = await PasswordResetToken.findOne({ tokenHash: hashToken(token) });
  if (!record || record.usedAt) throw ApiError.badRequest('Invalid or already-used reset link', 'invalid');
  if (record.expiresAt.getTime() < Date.now()) throw ApiError.badRequest('Reset link has expired', 'expired');

  const user = await User.findById(record.userId).select('+password');
  if (!user) throw ApiError.badRequest('Invalid reset link', 'invalid');

  user.password = password;
  await user.save();

  // Single-use: consume the token (and any other outstanding tokens for this user).
  record.usedAt = new Date();
  await record.save();
  await PasswordResetToken.deleteMany({ userId: user.id, usedAt: null });

  res.json({ success: true });
});
