# Formation Exceptionelle — Backend API

Node.js + Express + MongoDB REST API for the *Formation Exceptionelle* career platform
(LMS + Jobs board + Admin). Built to the shapes the existing Vue 3 frontend expects so the
frontend can switch off mock mode by setting `VITE_API_BASE_URL` — see
[`BACKEND_SPEC.md`](./BACKEND_SPEC.md).

## Tech stack

- **Runtime:** Node 20+ (ES Modules)
- **Framework:** Express 4
- **Database:** MongoDB + Mongoose
- **Auth:** JWT (`jsonwebtoken`) + bcrypt
- **Validation:** Zod
- **Security:** helmet, cors, express-rate-limit, express-mongo-sanitize
- **Payments:** Paystack (NGN) — real `initialize`/`verify`/`refund` + webhook signature check
- **Video:** Bunny Stream — direct upload + TUS presign + adaptive HLS + status webhook
- **File storage:** Cloudflare R2 (S3-compatible) for images, CVs, certificates — zero egress
- **Email:** Resend (HTTP API) or SMTP; console transport in dev
- **PDF:** pdfkit (certificates)
- **Docs:** OpenAPI 3 at `/api/docs` (Swagger UI) + `/api/openapi.json`

> The floating in-app "career assistant" chatbot has been replaced by a WhatsApp contact
> button on the frontend, so there is no chat/LLM endpoint in this API.

Every external provider is **env-gated and degrades gracefully** when its keys are absent —
`PAYMENT_PROVIDER=mock`, `VIDEO_PROVIDER=mock`, `STORAGE_DRIVER=local`, `MAIL_TRANSPORT=console`.
The whole app runs end-to-end with zero credentials, and each real integration switches on the
moment you supply its keys (see `.env.example`). Jobs are **admin-posted and go live
immediately** — there is no employer self-posting or job approval step.

## Quick start

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env        # (a working .env is already included for local dev)

# 3. Start MongoDB (local) — e.g. mongod, Docker, or set MONGODB_URI to Atlas
#    docker run -d -p 27017:27017 --name fe-mongo mongo:7

# 4. Seed the database (admin + demo instructor + 9 courses + 5 jobs)
npm run seed

# 5. Run the API
npm run dev      # auto-restart on change (node --watch)
# or
npm start
```

Server boots at `http://localhost:5000`. Health check: `GET /api/health`.

### Frontend wiring

Set in the frontend `.env.local`:

```
VITE_API_BASE_URL=http://localhost:5000   # origin only, no trailing /api
```

The backend mounts all routes under `/api`. CORS allows `CLIENT_ORIGIN`
(default `http://localhost:5173`).

## Seeded credentials

| Role | Email | Password |
|---|---|---|
| Admin | `admin@formationexceptionelle.com` | `Admin@2024!` |
| Instructor (demo) | `instructor@formationexceptionelle.com` | `Instructor@2024!` |

## Project structure

```
src/
├── server.js            # Express app + middleware + entry
├── config/              # env, db
├── constants.js         # shared enums (Appendix A)
├── models/              # Mongoose schemas (id transform via _shared.js)
├── middleware/          # auth, validate, upload, rateLimit, error
├── validators/          # Zod request schemas
├── controllers/         # route handlers
├── routes/              # one router per resource, aggregated in routes/index.js
├── services/            # paymentProvider(Paystack), videoProvider(Bunny), storageProvider(R2), mailer(Resend), certificatePdf, enrollmentService, orderService
├── docs/                # openapi.js (served at /api/docs)
├── utils/               # jwt, asyncHandler, ApiError, relativeTime
└── seed/                # seed.js + demo courses/jobs
```

## API surface (all under `/api`)

| Group | Base | Highlights |
|---|---|---|
| Auth | `/auth` | register, login, me, become-instructor, forgot/reset password |
| Courses | `/courses` | list/filter/sort, featured, detail, instructor CRUD, reviews |
| Enrollments | `/enrollments` | enroll (free), my-learning (`/me`), check |
| Progress | `/progress` | get, complete lecture |
| Jobs | `/jobs` | list/filter, featured, internships, detail (view++), CRUD |
| Applications | `/applications` | apply (+CV), my (`/me`), check, by-job, status, upload-cv |
| Videos | `/videos` | upload (Pattern A), create-upload (Pattern B), poll `/:assetId` |
| Payments | `/payments` | initialize, verify, webhook/:provider |
| Certificates | `/certificates` | generate, my (`/me`), verify `/:id` |
| Quizzes | `/quizzes` | get by course/lecture, submit |
| Uploads | `/uploads` | image |
| Contact | `/contact` | landing-page lead |
| Admin | `/admin` | stats, users/courses/jobs/payments management, analytics |

Errors use a consistent shape: `{ "error": { "message": "...", "code": "..." } }`.

## Tests

```bash
npm run smoke      # 67-check end-to-end run (in-memory MongoDB, no setup)
npm run test:unit  # Vitest provider unit tests
npm test           # both (used by CI)
```

## Going to production

All integrations are implemented and **activated purely via env vars** — no code changes
needed. Set the driver + its keys (see `.env.example`):

| Capability | Activate with | Keys |
|---|---|---|
| Payments (Paystack) | `PAYMENT_PROVIDER=paystack` | `PAYSTACK_SECRET_KEY`, `PAYSTACK_PUBLIC_KEY` |
| Video (Bunny Stream) | `VIDEO_PROVIDER=bunny` | `BUNNY_STREAM_LIBRARY_ID`, `BUNNY_STREAM_API_KEY`, `BUNNY_STREAM_CDN` |
| File storage (R2) | `STORAGE_DRIVER=r2` | `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_PUBLIC_URL` |
| Email (Resend) | `MAIL_TRANSPORT=resend` | `RESEND_API_KEY`, `MAIL_FROM` |
| Database | — | `MONGODB_URI` (MongoDB Atlas) |

Also set a strong `JWT_SECRET` and restrict `CLIENT_ORIGIN` to your real frontend origin(s).

**Webhooks** (set after deploy, pointing at your live API):
- Paystack → `https://<api>/api/payments/webhook/paystack`
- Bunny Stream → `https://<api>/api/videos/webhook/bunny`

### Deploy

- **Docker:** `docker compose up --build` (API + MongoDB locally), or build the image from the
  included `Dockerfile`.
- **Render:** the included `render.yaml` blueprint provisions the web service with a health
  check at `/api/health`; set the secret env vars in the dashboard.
- **CI:** `.github/workflows/ci.yml` runs the full test suite on every push/PR.
- **Frontend:** deploy the Vue app (Vercel) and set `VITE_API_BASE_URL` to the API origin.
