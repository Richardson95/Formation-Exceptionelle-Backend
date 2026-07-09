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

  // Video — provider: 'mock' | 'bunny' | 'mux'
  VIDEO_PROVIDER: process.env.VIDEO_PROVIDER || 'mock',
  // Bunny Stream
  BUNNY_STREAM_LIBRARY_ID: process.env.BUNNY_STREAM_LIBRARY_ID || '',
  BUNNY_STREAM_API_KEY: process.env.BUNNY_STREAM_API_KEY || '',
  BUNNY_STREAM_CDN: process.env.BUNNY_STREAM_CDN || '', // e.g. vz-xxxx.b-cdn.net
  BUNNY_STREAM_WEBHOOK_SECRET: process.env.BUNNY_STREAM_WEBHOOK_SECRET || '',
  // Mux (optional alternative)
  MUX_TOKEN_ID: process.env.MUX_TOKEN_ID || '',
  MUX_TOKEN_SECRET: process.env.MUX_TOKEN_SECRET || '',
  MUX_WEBHOOK_SECRET: process.env.MUX_WEBHOOK_SECRET || '',

  // Payments — provider: 'mock' | 'paystack'
  PAYMENT_PROVIDER: process.env.PAYMENT_PROVIDER || 'mock',
  PAYSTACK_SECRET_KEY: process.env.PAYSTACK_SECRET_KEY || '',
  PAYSTACK_PUBLIC_KEY: process.env.PAYSTACK_PUBLIC_KEY || '',
  // Where Paystack redirects the browser after payment (frontend route).
  PAYSTACK_CALLBACK_URL: process.env.PAYSTACK_CALLBACK_URL || '',

  // Email — transport: 'console' | 'resend' | 'smtp'
  MAIL_TRANSPORT: process.env.MAIL_TRANSPORT || 'console',
  RESEND_API_KEY: process.env.RESEND_API_KEY || '',
  SMTP_HOST: process.env.SMTP_HOST || '',
  SMTP_PORT: num(process.env.SMTP_PORT, 587),
  SMTP_USER: process.env.SMTP_USER || '',
  SMTP_PASS: process.env.SMTP_PASS || '',
  MAIL_FROM:
    process.env.MAIL_FROM ||
    'Formation Exceptionelle <no-reply@formationexceptionelle.com>',

  // File storage — STORAGE_DRIVER: 'local' | 'r2'
  STORAGE_DRIVER: process.env.STORAGE_DRIVER || 'local',
  R2_ACCOUNT_ID: process.env.R2_ACCOUNT_ID || '',
  R2_ACCESS_KEY_ID: process.env.R2_ACCESS_KEY_ID || '',
  R2_SECRET_ACCESS_KEY: process.env.R2_SECRET_ACCESS_KEY || '',
  R2_BUCKET: process.env.R2_BUCKET || '',
  R2_PUBLIC_URL: process.env.R2_PUBLIC_URL || '', // public bucket / custom domain base

  // Uploads
  UPLOAD_DIR: process.env.UPLOAD_DIR || 'uploads',
  MAX_VIDEO_MB: num(process.env.MAX_VIDEO_MB, 512),
  MAX_IMAGE_MB: num(process.env.MAX_IMAGE_MB, 2),
  MAX_CV_MB: num(process.env.MAX_CV_MB, 5),
};

env.isProd = env.NODE_ENV === 'production';
env.isDev = env.NODE_ENV === 'development';

// CLIENT_ORIGIN doubles as the CORS allowlist, so it may hold several
// comma-separated origins. Anything that builds a URL for the browser — gateway
// redirects, password-reset links, email buttons — needs exactly one: the first,
// which is the canonical site origin.
env.SITE_ORIGIN = env.CLIENT_ORIGIN.split(',')[0].trim().replace(/\/+$/, '');

// ── Derived "is this integration actually configured?" flags ────────────────
// Each real provider activates only when its driver is selected AND its required
// credentials are present; otherwise the code transparently falls back to mock.
env.paystackEnabled =
  env.PAYMENT_PROVIDER === 'paystack' && !!env.PAYSTACK_SECRET_KEY;
env.bunnyEnabled =
  env.VIDEO_PROVIDER === 'bunny' &&
  !!env.BUNNY_STREAM_LIBRARY_ID &&
  !!env.BUNNY_STREAM_API_KEY;
env.r2Enabled =
  env.STORAGE_DRIVER === 'r2' &&
  !!env.R2_ACCOUNT_ID &&
  !!env.R2_ACCESS_KEY_ID &&
  !!env.R2_SECRET_ACCESS_KEY &&
  !!env.R2_BUCKET;
env.resendEnabled = env.MAIL_TRANSPORT === 'resend' && !!env.RESEND_API_KEY;

export default env;
