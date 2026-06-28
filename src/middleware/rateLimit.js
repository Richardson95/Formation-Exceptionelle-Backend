import rateLimit from 'express-rate-limit';

const common = {
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { message: 'Too many requests, please try again later.', code: 'rate_limited' } },
};

// General API limiter.
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  ...common,
});

// Stricter limiter for auth (login/register/forgot/reset).
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  ...common,
});
