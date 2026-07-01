import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import mongoSanitize from 'express-mongo-sanitize';
import path from 'path';
import { fileURLToPath } from 'url';

import env from './config/env.js';
import { connectDB } from './config/db.js';
import apiRouter from './routes/index.js';
import { notFoundHandler, errorHandler } from './middleware/error.js';
import { apiLimiter } from './middleware/rateLimit.js';
import { uploadRoot } from './middleware/upload.js';
import { buildOpenApiSpec } from './docs/openapi.js';

export function createApp() {
  const app = express();

  app.set('trust proxy', 1);
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(
    cors({
      origin: env.CLIENT_ORIGIN.split(',').map((o) => o.trim()),
      credentials: true,
    })
  );

  // Stripe/Paystack webhooks need the raw body — mount before json parser.
  app.use('/api/payments/webhook', express.raw({ type: '*/*' }));

  app.use(express.json({ limit: '5mb' }));
  app.use(express.urlencoded({ extended: true, limit: '5mb' }));
  app.use(mongoSanitize());
  if (!env.isProd) app.use(morgan('dev'));

  // Serve locally-stored uploads (dev fallback when no cloud storage configured).
  app.use('/uploads', express.static(uploadRoot));

  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', env: env.NODE_ENV, time: new Date().toISOString() });
  });

  // API documentation (OpenAPI JSON + Swagger UI from CDN — no extra dependency).
  app.get('/api/openapi.json', (req, res) => res.json(buildOpenApiSpec()));
  app.get('/api/docs', (req, res) => {
    res.type('html').send(`<!doctype html><html><head>
  <meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>Formation Exceptionelle API — Docs</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css"/>
</head><body>
  <div id="swagger"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script>
    window.ui = SwaggerUIBundle({ url: '/api/openapi.json', dom_id: '#swagger' });
  </script>
</body></html>`);
  });

  app.use('/api', apiLimiter, apiRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

async function start() {
  await connectDB();
  const app = createApp();
  app.listen(env.PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`[server] Formation Exceptionelle API listening on http://localhost:${env.PORT}`);
    console.log(`[server] CORS origin: ${env.CLIENT_ORIGIN}`);
  });
}

// Only auto-start when run directly (not when imported by tests/seed).
const invokedDirectly =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (invokedDirectly || process.env.START_SERVER === '1') {
  start().catch((err) => {
    // eslint-disable-next-line no-console
    console.error('[server] failed to start:', err);
    process.exit(1);
  });
}

export default createApp;
