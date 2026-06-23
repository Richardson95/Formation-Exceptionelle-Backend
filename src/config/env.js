import dotenv from 'dotenv';

dotenv.config();

const num = (v, fallback) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

const env = {
  // Server
  PORT: num(process.env.PORT, 5000),
  NODE_ENV: process.env.NODE_ENV || 'development',
  CLIENT_ORIGIN: process.env.CLIENT_ORIGIN || 'http://localhost:5173',

  // Database
  MONGODB_URI:
    process.env.MONGODB_URI || 'mongodb://localhost:27017/formation_exceptionelle',

  // Auth
  JWT_SECRET: process.env.JWT_SECRET || 'dev-only-secret-change-me',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
  BCRYPT_ROUNDS: num(process.env.BCRYPT_ROUNDS, 12),

  // Admin seed
  SEED_ADMIN_EMAIL:
    process.env.SEED_ADMIN_EMAIL || 'admin@formationexceptionelle.com',
  SEED_ADMIN_PASSWORD: process.env.SEED_ADMIN_PASSWORD || 'Admin@2024!',

  // Video
  VIDEO_PROVIDER: process.env.VIDEO_PROVIDER || 'mock',
  MUX_TOKEN_ID: process.env.MUX_TOKEN_ID || '',
  MUX_TOKEN_SECRET: process.env.MUX_TOKEN_SECRET || '',
  MUX_WEBHOOK_SECRET: process.env.MUX_WEBHOOK_SECRET || '',

  // Payments
  PAYMENT_PROVIDER: process.env.PAYMENT_PROVIDER || 'mock',
  PAYSTACK_SECRET_KEY: process.env.PAYSTACK_SECRET_KEY || '',
  PAYSTACK_PUBLIC_KEY: process.env.PAYSTACK_PUBLIC_KEY || '',
  STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY || '',
  STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET || '',

  // Email
  MAIL_TRANSPORT: process.env.MAIL_TRANSPORT || 'console',
  SMTP_HOST: process.env.SMTP_HOST || '',
  SMTP_PORT: num(process.env.SMTP_PORT, 587),
  SMTP_USER: process.env.SMTP_USER || '',
  SMTP_PASS: process.env.SMTP_PASS || '',
  MAIL_FROM:
    process.env.MAIL_FROM ||
    'Formation Exceptionelle <no-reply@formationexceptionelle.com>',
  RESEND_API_KEY: process.env.RESEND_API_KEY || '',

  // AI
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY || '',
  AI_MODEL: process.env.AI_MODEL || 'claude-haiku-4-5',

  // Uploads
  UPLOAD_DIR: process.env.UPLOAD_DIR || 'uploads',
  MAX_VIDEO_MB: num(process.env.MAX_VIDEO_MB, 512),
  MAX_IMAGE_MB: num(process.env.MAX_IMAGE_MB, 2),
  MAX_CV_MB: num(process.env.MAX_CV_MB, 5),
};

env.isProd = env.NODE_ENV === 'production';
env.isDev = env.NODE_ENV === 'development';

export default env;
