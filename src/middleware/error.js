import { ZodError } from 'zod';
import env from '../config/env.js';
import ApiError from '../utils/ApiError.js';

export function notFoundHandler(req, res, next) {
  next(new ApiError(404, `Route not found: ${req.method} ${req.originalUrl}`, 'not_found'));
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal server error';
  let code = err.code;

  // Zod validation errors
  if (err instanceof ZodError) {
    statusCode = 400;
    code = 'VALIDATION';
    message = err.issues.map((i) => `${i.path.join('.') || 'body'}: ${i.message}`).join('; ');
  }

  // Mongoose validation
  if (err.name === 'ValidationError' && err.errors) {
    statusCode = 400;
    code = 'VALIDATION';
    message = Object.values(err.errors)
      .map((e) => e.message)
      .join('; ');
  }

  // Mongoose bad ObjectId
  if (err.name === 'CastError') {
    statusCode = 400;
    code = 'invalid_id';
    message = `Invalid ${err.path}: ${err.value}`;
  }

  // Duplicate key
  if (err.code === 11000) {
    statusCode = 409;
    code = 'duplicate_key';
    const field = Object.keys(err.keyValue || {})[0];
    message =
      field === 'email'
        ? 'An account with this email already exists'
        : `Duplicate value for ${field}`;
  }

  // JWT
  if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    code = 'invalid_token';
    message = 'Invalid token';
  }
  if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    code = 'token_expired';
    message = 'Session expired, please log in again';
  }

  if (statusCode >= 500) {
    // eslint-disable-next-line no-console
    console.error('[error]', err);
  }

  const body = { error: { message } };
  if (code) body.error.code = code;
  if (env.isDev && statusCode >= 500) body.error.stack = err.stack;

  res.status(statusCode).json(body);
}
