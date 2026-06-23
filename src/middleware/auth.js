import asyncHandler from '../utils/asyncHandler.js';
import ApiError from '../utils/ApiError.js';
import { verifyToken } from '../utils/jwt.js';
import User from '../models/User.js';

function extractToken(req) {
  const header = req.headers.authorization || '';
  if (header.startsWith('Bearer ')) return header.slice(7).trim();
  return null;
}

/**
 * Require a valid JWT. Attaches the safe user doc to req.user.
 */
export const authRequired = asyncHandler(async (req, res, next) => {
  const token = extractToken(req);
  if (!token) throw ApiError.unauthorized('Authentication required');

  const payload = verifyToken(token);
  const user = await User.findById(payload.sub);
  if (!user) throw ApiError.unauthorized('Account no longer exists');
  if (user.status === 'suspended') {
    throw ApiError.forbidden('Your account has been suspended', 'suspended');
  }

  req.user = user;
  req.userId = user.id;
  next();
});

/**
 * Attach req.user if a valid token is present, but don't fail when it's absent.
 */
export const authOptional = asyncHandler(async (req, res, next) => {
  const token = extractToken(req);
  if (!token) return next();
  try {
    const payload = verifyToken(token);
    const user = await User.findById(payload.sub);
    if (user && user.status !== 'suspended') {
      req.user = user;
      req.userId = user.id;
    }
  } catch {
    /* ignore — treat as anonymous */
  }
  next();
});

export const adminOnly = (req, res, next) => {
  if (!req.user) return next(ApiError.unauthorized('Authentication required'));
  if (req.user.role !== 'admin') {
    return next(ApiError.forbidden('Admin access required'));
  }
  next();
};

export const instructorOnly = (req, res, next) => {
  const role = req.user?.role;
  if (role !== 'instructor' && role !== 'admin') {
    return next(ApiError.forbidden('Instructor access required'));
  }
  next();
};

/**
 * Allow the request only if the current user owns the resource or is admin.
 * `getOwnerId(req)` should resolve to the owning user id (string), possibly async.
 */
export function ownerOrAdmin(getOwnerId) {
  return asyncHandler(async (req, res, next) => {
    if (req.user?.role === 'admin') return next();
    const ownerId = await getOwnerId(req);
    if (ownerId == null) throw ApiError.notFound('Resource not found');
    if (String(ownerId) !== String(req.userId)) {
      throw ApiError.forbidden('You do not have permission to modify this resource', 'not_owner');
    }
    next();
  });
}
