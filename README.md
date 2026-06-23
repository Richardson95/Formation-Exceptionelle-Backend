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
- **Uploads:** Multer (local disk fallback; pluggable to Mux/S3/Cloudinary)
- **Email:** Nodemailer (console transport in dev)
- **AI assistant:** Anthropic Claude (`@anthropic-ai/sdk`) with a canned fallback
- **PDF:** pdfkit (certificates)

External providers (video, payments, email, AI) **degrade gracefully** when their keys are
absent: `VIDEO_PROVIDER=mock`, `PAYMENT_PROVIDER=mock`, `MAIL_TRANSPORT=console`, and the AI
assistant uses keyword-based canned replies. This lets the whole app run with zero credentials.

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
├── services/            # videoProvider, paymentProvider, mailer, ai, certificatePdf, enrollmentService
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
| Assistant | `/assistant` | Claude-backed chat with fallback |
| Uploads | `/uploads` | image |
| Contact | `/contact` | landing-page lead |
| Admin | `/admin` | stats, users/courses/jobs/payments management, analytics |

Errors use a consistent shape: `{ "error": { "message": "...", "code": "..." } }`.

## Going to production

Fill in the real provider calls (marked `TODO`) in:
- `services/videoProvider.js` — Mux / Cloudflare Stream / S3
- `services/paymentProvider.js` — Paystack / Stripe (+ webhook verification)
- `services/mailer.js` — set `MAIL_TRANSPORT=smtp` and SMTP creds (or Resend)
- `services/ai.js` — set `ANTHROPIC_API_KEY`

Also: move uploads to cloud storage, set a strong `JWT_SECRET`, restrict `CLIENT_ORIGIN`,
and run behind PM2 or Docker.
