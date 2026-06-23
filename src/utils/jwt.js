import jwt from 'jsonwebtoken';
import env from '../config/env.js';

/**
 * Sign a JWT for a user. Payload: { sub: userId, role }.
 */
export function signToken(user) {
  const id = user.id || user._id?.toString();
  return jwt.sign({ sub: id, role: user.role }, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN,
  });
}

export function verifyToken(token) {
  return jwt.verify(token, env.JWT_SECRET);
}
