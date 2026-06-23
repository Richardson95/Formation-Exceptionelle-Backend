# Formation Exceptionelle — Complete Backend Specification

> **Purpose of this document**
> This is a **single, complete, self-contained brief** for building the backend of the
> *Formation Exceptionelle* platform. It was written by reverse-engineering the **entire
> existing Vue 3 frontend** (every store, every view, every form, every service). It contains
> everything required to build a production backend that the existing frontend can talk to
> with minimal frontend changes.
>
> The frontend currently runs **100% on mock data persisted in `localStorage`**. Your job is to
> replace that mock layer with a **real Node.js + Express + MongoDB REST API**. Nothing about the
> UI behaviour should change — only the data source.
>
> **Read this whole file before writing code.** Section 13 ("Frontend Integration Contract")
> tells you exactly which shapes the frontend already expects — match them.

---

## Table of Contents

1. [Product Overview](#1-product-overview)
2. [Existing Frontend — Tech Stack & Structure](#2-existing-frontend--tech-stack--structure)
3. [Recommended Backend Tech Stack](#3-recommended-backend-tech-stack)
4. [Roles & Permissions Model](#4-roles--permissions-model)
5. [Data Models (Database Schema)](#5-data-models-database-schema)
6. [Authentication & Authorization](#6-authentication--authorization)
7. [REST API — Full Endpoint Reference](#7-rest-api--full-endpoint-reference)
8. [Video Upload & Streaming Architecture](#8-video-upload--streaming-architecture)
9. [Payments & Checkout](#9-payments--checkout)
10. [Certificates](#10-certificates)
11. [AI Career Assistant](#11-ai-career-assistant)
12. [Email / Notifications](#12-email--notifications)
13. [Frontend Integration Contract](#13-frontend-integration-contract)
14. [Recommended Project Structure](#14-recommended-project-structure)
15. [Environment Variables](#15-environment-variables)
16. [Seed Data](#16-seed-data)
17. [Security, Validation & Non-Functional Requirements](#17-security-validation--non-functional-requirements)
18. [Suggested Build Order / Milestones](#18-suggested-build-order--milestones)

---

## 1. Product Overview

**Formation Exceptionelle** — tagline *"Your Partner In Career Development"* — is a full-stack
career-development platform for the African (primarily Nigerian) market. It combines three
products in one app:

1. **LMS (Learning Management System)** — a Udemy-style course marketplace: browse, buy, enroll,
   watch video lessons, take quizzes, track progress, earn certificates. Instructors can create
   and sell courses.
2. **Jobs & Internships board** — browse/search jobs, apply with a CV + cover letter, and post
   jobs as an employer.
3. **Admin panel** — manage users, courses, jobs, payments, and view analytics.

Plus supporting features: a marketing **landing page**, **authentication**, a **"Become an
Instructor"** flow, and a floating **AI career assistant chatbot**.

Currency note: courses are priced in **USD**, jobs/salaries in **NGN (₦)**.

---

## 2. Existing Frontend — Tech Stack & Structure

The frontend already exists and is **not** to be rebuilt. Know it so your API matches it.

**Stack**
- Vue 3 (Composition API, `<script setup>`)
- Vue Router 4 (with auth guards)
- Pinia (state management) — **this is the layer you are replacing the internals of**
- Vite 5 (build tool)
- Tailwind CSS v3 (custom purple/gold theme)
- **axios** (already a dependency — the HTTP client you'll wire up)
- Supporting libs: vue3-toastify (toasts), AOS (scroll animations), @heroicons/vue, @vueuse/core,
  chart.js + vue-chartjs (admin analytics), swiper, dayjs, lucide-vue-next

**Theme colors** (for reference, e.g. certificate/email templates)
- Primary Purple: `#4c1d95` / `#7c3aed`
- Gold/Yellow: `#f59e0b`

**Key frontend files (the source of truth for shapes & behaviour)**
```
src/
├── main.js                       # app bootstrap (Pinia, router, toastify, AOS)
├── router/index.js               # all routes + navigation guards (auth/role gating)
├── services/
│   └── videoService.js           # ★ the ONLY place that talks to the video backend (upload seam)
├── stores/                       # ★ Pinia stores = the mock "backend" you are replacing
│   ├── auth.js                   # users, login/register/logout/profile/becomeInstructor
│   ├── lms.js                    # courses, enrollments, progress, reviews
│   ├── cart.js                   # cart + wishlist (can stay client-side, see §7.4)
│   ├── jobs.js                   # jobs + applications
│   └── admin.js                  # aggregated analytics (computed from other stores)
├── views/
│   ├── HomeView.vue              # landing page (composes landing/* sections)
│   ├── auth/LoginView.vue, RegisterView.vue
│   ├── lms/ LMSView, CourseDetailView, CourseLearnView, CartView, CheckoutView,
│   │        StudentDashboardView, InstructorDashboardView, CreateCourseView
│   ├── jobs/ JobsView, JobDetailView, ApplyJobView, PostJobView
│   ├── admin/ AdminDashboardView, AdminUsersView, AdminCoursesView, AdminJobsView,
│   │          AdminAnalyticsView, AdminPaymentsView
│   ├── BecomeInstructorView.vue
│   └── NotFoundView.vue
└── components/
    ├── layout/ AppHeader.vue, AppFooter.vue
    ├── landing/ Hero, Services, Faculty, FeatureCards, FeaturedCourses, Stats,
    │            Testimonials, Contact, Corporate, Clients (sections)
    ├── lms/ CourseCard.vue, QuizComponent.vue, VideoUploader.vue
    ├── jobs/ JobCard.vue
    ├── admin/ AdminLayout.vue
    └── ai/ AIAssistant.vue
```

**How the mock currently works (what you are replacing):**
- Each Pinia store reads/writes `localStorage` keys: `fe_user`, `fe_token`, `fe_users`,
  `fe_courses`, `fe_enrollments`, `fe_progress`, `fe_reviews`, `fe_cart`, `fe_wishlist`,
  `fe_jobs`, `fe_applications`.
- All "API calls" are `setTimeout` delays returning local data.
- A token is a fake string: `fe-token-<userId>-<timestamp>`.
- The admin user is **seeded automatically** on first load.

---

## 3. Recommended Backend Tech Stack

The user requested **Node.js + Express**. Here is the full recommended stack:

| Concern | Recommendation | Notes |
|---|---|---|
| Runtime | **Node.js 20 LTS+** | ES Modules (the frontend uses `"type": "module"`; keep parity). |
| Framework | **Express 4 (or 5)** | Simple, matches request. |
| Database | **MongoDB** + **Mongoose** | Document model fits the nested course/section/lecture data perfectly (the frontend already stores courses as nested JSON). PostgreSQL + Prisma is a fine alternative if relational is preferred — see note below. |
| Auth | **JWT** (`jsonwebtoken`) + **bcrypt** (password hashing) | Frontend already stores a bearer token and sends role-based requests. |
| Validation | **Zod** or **express-validator** / **Joi** | Validate every request body. |
| File/Video upload | **Multer** (multipart parsing) + a video provider (see §8) | Frontend `videoService.js` already defines the exact upload contract. |
| Video hosting/transcode | **Mux** *or* **Cloudflare Stream** *or* **AWS S3 + CloudFront** | `.env.example` already references `VITE_VIDEO_PROVIDER = mux | cloudflare-stream | s3`. **Mux or Cloudflare Stream strongly recommended** (handles HLS transcoding & adaptive streaming for you). |
| Image upload (thumbnails, avatars, logos, CVs) | **Cloudinary** *or* **AWS S3** | Thumbnails/avatars/CVs. |
| Payments | **Paystack** (primary, NGN-friendly) and/or **Stripe** | Frontend checkout supports Card, PayPal, Bank Transfer. Paystack covers card+bank for Nigeria. |
| Email | **Nodemailer** (SMTP) or **Resend** / **SendGrid** | Welcome, enrollment, application, certificate, password-reset emails. |
| AI chatbot | **Anthropic Claude API** (`@anthropic-ai/sdk`) | Replace the canned chatbot with a real LLM (see §11). Use the latest model, e.g. `claude-opus-4-8` or a cheaper `claude-haiku-4-5` for chat. |
| Security middleware | **helmet**, **cors**, **express-rate-limit**, **express-mongo-sanitize** | Standard hardening. |
| Logging | **morgan** (dev) + **pino**/**winston** (prod) | |
| Config | **dotenv** | |
| Process mgmt (prod) | **PM2** or Docker | |
| API docs | **Swagger / OpenAPI** (`swagger-ui-express`) | Optional but recommended. |
| Testing | **Jest** + **Supertest** | Optional but recommended. |

> **Relational alternative:** If you prefer PostgreSQL, the data maps cleanly to tables:
> `users`, `courses`, `sections`, `lectures`, `enrollments`, `lecture_progress`, `reviews`,
> `jobs`, `applications`, `orders`, `order_items`, `certificates`. Use Prisma. The course's nested
> sections/lectures would become child tables. **MongoDB is recommended** because the frontend
> already treats a course as one nested document.

---

## 4. Roles & Permissions Model

Three roles (from `auth.js` and the router guards):

| Role | Value | Capabilities |
|---|---|---|
| Participant (Learner/Employer) | `participant` | Default for all new sign-ups. Browse & enroll in courses, learn, take quizzes, earn certificates, apply to jobs, post jobs, become an instructor. |
| Instructor | `instructor` | Everything a participant can do **plus** create/edit/manage their own courses, see instructor dashboard & earnings. A participant becomes an instructor via the "Become Instructor" flow. |
| Admin | `admin` | Full access to the admin panel: manage all users/courses/jobs, view analytics & payments. |

**Important nuances pulled from the frontend:**
- `isInstructor` is computed as `role === 'instructor' || role === 'admin'` (admins are treated as instructors too).
- Registration **always** creates `participant` (the Register UI shows "Learner"/"Employer" buttons but both submit `role: 'participant'`).
- The admin account is seeded (see §16). Credentials currently:
  `admin@formationexceptionelle.com` / `Admin@2024!`.
- Router guard meta flags in use: `requiresAuth`, `requiresAdmin`, `requiresRole: 'instructor'`,
  and `guest: true` (login/register redirect away if already authenticated).
- On an auth failure the frontend redirects to `/auth/login?redirect=<path>&reason=<role|auth>`.

---

## 5. Data Models (Database Schema)

These shapes are taken **directly** from the frontend stores and forms. Field names must match
what the frontend reads (see §13). Add `_id`/`id`, `createdAt`, `updatedAt` everywhere.

> **ID note:** The frontend reads `id` (string) on every entity. With Mongoose, expose `_id`
> as `id` (use a toJSON transform) or generate string ids. Existing mock ids look like
> `c001`, `j001`, `user-<ts>`, `inst-001`, `app-<ts>`, `r<ts>`, `s1`, `l1`. Keep accepting
> string ids; generate ObjectIds for new records but always serialize an `id` field.

### 5.1 User
```js
User {
  id: string,
  firstName: string,            // required
  lastName: string,             // required
  email: string,                // required, unique, lowercase
  password: string,             // hashed (bcrypt); NEVER returned in any response
  role: 'participant' | 'instructor' | 'admin',  // default 'participant'
  avatar: string | null,        // image URL
  bio: string,                  // default ''
  profession: string,           // default ''
  phone: string,                // default ''
  enrolledCourses: string[],    // course ids (kept for parity; source of truth is Enrollment)
  completedCourses: string[],   // course ids
  instructorData: {             // present once they apply to teach (see BecomeInstructor form)
    title: string,              // professional title / expertise
    experience: string,         // '1-2 years' | '3-5 years' | '5-10 years' | '10+ years'
    courseTopic: string,
    category: string,
    linkedin: string,
    bio: string
  } | null,
  status: 'active' | 'suspended',   // NEW (admin "Suspend" action implies this)
  createdAt: ISODate,
  updatedAt: ISODate
}
```
**Safe user object** (what the API must return — everything except `password`):
all fields above minus `password`.

### 5.2 Course
The richest entity. Taken from `MOCK_COURSES` in `lms.js` and the `CreateCourseView` form.
```js
Course {
  id: string,
  title: string,                // required
  subtitle: string,             // required
  description: string,          // required
  instructor: {                 // denormalized instructor summary (frontend reads course.instructor.name etc.)
    id: string,
    name: string,
    avatar: string | null,
    rating: number,
    students: number
  },
  instructorId: string,         // set when created via API (CreateCourse passes authStore.user.id)
  category: string,             // one of CATEGORIES (see below)
  subcategory: string,
  level: 'Beginner' | 'Intermediate' | 'Advanced' | 'All Levels',
  language: string,             // 'English' | 'French' | 'Yoruba' | 'Hausa' | 'Igbo'
  price: number,                // USD; 0 if free
  originalPrice: number,        // USD strike-through price
  currency: string,             // 'USD'
  thumbnail: string,            // image URL (or data URL in mock)
  previewVideo: string,         // video URL
  rating: number,               // avg, 0 until reviewed
  reviewCount: number,
  enrolledCount: number,
  duration: string,             // human label e.g. '65 hours'
  lectureCount: number,
  lastUpdated: string,          // 'YYYY-MM-DD'
  certificate: boolean,         // default true
  tags: string[],
  requirements: string[],
  objectives: string[],         // "What students will learn"
  sections: Section[],          // nested curriculum (see below)
  isPaid: boolean,
  featured: boolean,            // shown on landing page / featured carousels
  status: 'draft' | 'pending' | 'published' | 'rejected',  // moderation state (see below)
  submittedAt: ISODate | null,  // when the instructor submitted for review
  rejectionReason: string,      // admin's note when status === 'rejected'
  createdAt: ISODate,
  updatedAt: ISODate
}
```
**Course moderation workflow (BUILT in the frontend):** instructor-created courses are **not** public
immediately. On submit they get `status: 'pending'`; an admin must **approve** (→ `published`, goes live)
or **reject** (→ `rejected` with `rejectionReason`, shown back to the instructor). Only `published`
courses appear in public listings/catalog/featured. Seeded demo courses are `published`. (`draft` is
reserved for the "Save Draft" action.)
```js
// Section and Lecture are embedded sub-documents inside course.sections[]

Section {
  id: string,
  title: string,
  duration: string,             // human label e.g. '2h 30m'
  lectures: Lecture[]
}

Lecture {
  id: string,
  title: string,
  duration: string,             // e.g. '8:32' for video, '10 questions' for quiz, 'Assignment'
  type: 'video' | 'quiz' | 'assignment',
  preview: boolean,             // if true, playable without enrollment
  videoUrl: string,             // playable URL (resolved from videoAsset)
  videoAsset: VideoAsset | null // the upload result object (see §8)
}
```
**CATEGORIES** (course): `Corporate Law, Finance & Capital Markets, Mergers & Acquisitions, Corporate Governance, Taxation, Energy & ESG, Dispute Resolution`
**LEVELS**: `Beginner, Intermediate, Advanced, All Levels`

### 5.3 Enrollment
```js
Enrollment {
  id: string,
  userId: string,               // required
  courseId: string,             // required
  enrolledAt: ISODate,
  // unique compound index on (userId, courseId)
}
```

### 5.4 Progress (per user, per course)
Currently keyed `${userId}-${courseId}` in localStorage. Model as its own collection.
```js
Progress {
  id: string,
  userId: string,
  courseId: string,
  completedLectures: string[],  // lecture ids
  percentage: number,           // 0-100, = round(completed / totalLectures * 100)
  completedAt: ISODate | null,  // set when percentage hits 100
  // unique compound index on (userId, courseId)
}
```

### 5.5 Review
```js
Review {
  id: string,
  userId: string,
  courseId: string,
  userName: string,             // denormalized display name
  rating: number,               // 1-5
  comment: string,
  createdAt: ISODate
}
```
On create: recompute the course's `rating` (avg of its reviews) and `reviewCount`.

### 5.6 Job
From `MOCK_JOBS` in `jobs.js` and the `PostJobView` form.
```js
Job {
  id: string,
  title: string,                // required
  company: string,              // required
  companyLogo: string | null,
  location: string,             // e.g. 'Lagos, Nigeria' or 'Remote'
  locationType: 'Remote' | 'On-site' | 'Hybrid',
  type: 'Full-time' | 'Part-time' | 'Internship' | 'Contract' | 'Freelance',
  category: string,             // JOB_CATEGORIES (below)
  salary: { min: number, max: number, currency: string /* 'NGN' */, period: 'monthly'|'yearly'|'hourly' },
  experience: string,           // e.g. '3-5 years'
  level: 'Entry' | 'Mid-level' | 'Senior' | 'Manager',
  description: string,          // required
  responsibilities: string[],
  requirements: string[],
  benefits: string[],
  skills: string[],
  deadline: string,             // 'YYYY-MM-DD' (required)
  postedAt: string,             // 'YYYY-MM-DD'
  postedBy: string,             // user id
  applications: number,         // count (increment on apply)
  views: number,
  isActive: boolean,            // visible publicly; false while pending/closed
  isFeatured: boolean,          // default false
  status: 'pending' | 'approved' | 'rejected',  // moderation state (see below)
  submittedAt: ISODate | null,
  rejectionReason: string,
  createdAt: ISODate,
  updatedAt: ISODate
}
```
**Job moderation workflow (BUILT in the frontend):** employer-posted jobs are **not** public
immediately — on submit they get `status: 'pending'` and `isActive: false`. An admin must **approve**
(→ `status: 'approved'`, `isActive: true`) or **reject** (→ `rejected` + `rejectionReason`). Only active,
approved jobs appear in public listings. Seeded demo jobs are `approved`.

**JOB_CATEGORIES**: `Legal, Finance, Compliance & Risk, Corporate Governance, Tax, Energy & Resources, Consulting`
**JOB_TYPES**: `Full-time, Part-time, Internship, Contract, Freelance`
**LOCATION_TYPES**: `Remote, On-site, Hybrid`

### 5.7 Application (job application)
From `applyForJob` in `jobs.js` and the `ApplyJobView` form.
```js
Application {
  id: string,
  userId: string,
  jobId: string,
  fullName: string,
  email: string,
  phone: string,
  location: string,             // current location (optional)
  linkedin: string,
  portfolio: string,            // portfolio/GitHub URL
  experience: string,           // 'Less than 1 year' | '1-2 years' | '3-5 years' | '5-10 years' | '10+ years'
  coverLetter: string,          // required
  cvName: string,               // file name (mock). With real backend: cvUrl too.
  cvUrl: string | null,         // NEW: uploaded CV file URL
  status: 'pending' | 'reviewed' | 'shortlisted' | 'rejected' | 'accepted',  // default 'pending'
  appliedAt: ISODate,
  reviewedAt: ISODate | null,   // set when the employer/admin changes status
  // unique compound index on (userId, jobId) — a user applies once per job
}
```

### 5.8 Order / Payment (NEW — implied by Checkout & AdminPayments)
The mock has no order entity (it just enrolls on payment). For a real backend you need orders.
```js
Order {
  id: string,
  userId: string,
  items: [{ courseId: string, title: string, price: number }],
  subtotal: number,
  savings: number,
  total: number,                // USD
  currency: string,             // 'USD'
  paymentMethod: 'card' | 'paypal' | 'bank',
  paymentProvider: string,      // 'paystack' | 'stripe' | ...
  providerReference: string,    // gateway transaction ref
  billing: { firstName, lastName, email, country },
  status: 'pending' | 'paid' | 'failed' | 'refunded',
  createdAt: ISODate,
  paidAt: ISODate | null
}
```
On successful payment: create `Enrollment` for each course in `items`, increment course
`enrolledCount`, send confirmation email.

### 5.9 Certificate (NEW — implied by CourseLearnView)
```js
Certificate {
  id: string,                   // e.g. 'FE-<COURSEID>-<USERID6>' (frontend builds this label)
  userId: string,
  courseId: string,
  userName: string,
  courseTitle: string,
  issuedAt: ISODate,
  pdfUrl: string | null         // generated certificate PDF
}
```
Frontend builds the display ID as `FE-{courseId.toUpperCase()}-{userId.slice(-6).toUpperCase()}`.

### 5.10 PasswordResetToken (BUILT in frontend — see §6)
```js
PasswordResetToken {
  id: string,
  userId: string,
  tokenHash: string,        // hash of the token (never store plaintext)
  expiresAt: ISODate,       // ~30 minutes from creation
  usedAt: ISODate | null,   // set when consumed (single-use)
  createdAt: ISODate
}
```

### 5.11 ChatMessage / Conversation (optional — for AI assistant persistence)
```js
Conversation { id, userId, messages: [{ role: 'user'|'assistant', content, createdAt }], createdAt }
```
Persisting chat is optional; a stateless endpoint is acceptable (see §11).

---

## 6. Authentication & Authorization

### Behaviour the frontend already implements
- **Register** (`POST` expected): takes `{ firstName, lastName, email, phone, profession, password, role }`
  (role is forced to `participant`). On success returns the **safe user** + a **token**, both of
  which the frontend stores. It auto-logs-in and redirects to `route.query.redirect || '/lms'`.
  Must reject duplicate emails with message `"An account with this email already exists"`.
- **Login**: `{ email, password }`. On failure throw message `"Invalid email or password"`.
  On success return safe user + token, toast `"Welcome back, <firstName>!"`.
- **Logout**: clears token/user client-side (a `POST /auth/logout` is optional/no-op or token blacklist).
- **Update profile**: partial update of the current user; returns updated safe user.
- **Become instructor**: sets `role = 'instructor'` and stores `instructorData`. (In the mock it's
  auto-approved instantly. You may keep auto-approve or introduce an admin approval queue — but the
  current UX expects immediate success: "Application Approved! You are now an instructor.")

### JWT design
- Sign JWT with `{ sub: userId, role }`, expiry e.g. `7d`. Return as `token`.
- `Authorization: Bearer <token>` on protected requests (wire axios interceptor on the frontend — see §13).
- Password rules from RegisterView: **min 8 chars**; UI computes a strength score (length, uppercase,
  number, symbol). Enforce min length server-side; recommend requiring at least medium strength.

### Middleware to build
- `authRequired` — verifies JWT, attaches `req.user` (safe user).
- `adminOnly` — 403 unless `req.user.role === 'admin'`.
- `instructorOnly` — 403 unless role is `instructor` or `admin`.
- `ownerOrAdmin(resourceOwnerId)` — for editing own course / withdrawing own application.

### Password reset (BUILT in the frontend — wire these endpoints)
The forgot/reset-password flow now **exists in the frontend** (it was added after the initial mock).
Pages and behaviour you must support:

**Pages / routes (frontend):**
- `/auth/forgot-password` → `ForgotPasswordView.vue` — user enters their email, requests a reset link.
- `/auth/reset-password?token=<token>` → `ResetPasswordView.vue` — user sets a new password using the
  token from the email link. Validates the token on load and shows an "invalid/expired" state if bad.
- The **"Forgot password?"** link on `/auth/login` now routes to `/auth/forgot-password`.

**Frontend mock currently does (replace with real backend):**
- `forgotPassword(email)` — generates a token `reset-<userId>-<random>`, stores it in `localStorage`
  (`fe_reset_tokens` map of `token → { email, expiresAt }`), expiry **30 minutes**. Returns
  `{ token }` **only so the demo can display the link** (no email server in the mock). Always shows the
  same neutral message regardless of whether the email exists (no account enumeration).
- `verifyResetToken(token)` — returns `{ valid, reason?: 'invalid'|'expired', email? }`.
- `resetPassword(token, newPassword)` — validates token (existence + not expired), updates the user's
  password, **consumes (deletes) the token** so it can't be reused.

**Backend endpoints to build:**

| Method | Path | Auth | Body | Behaviour |
|---|---|---|---|---|
| POST | `/api/auth/forgot-password` | public | `{ email }` | If a user with that email exists: create a single-use reset token (random, hashed at rest), set ~30-min expiry, **email** the user a link `${CLIENT_ORIGIN}/auth/reset-password?token=<token>`. **Always** return the same neutral `{ success: true }` response (don't reveal whether the email is registered). Rate-limit this endpoint. |
| GET | `/api/auth/reset-password/verify?token=` | public | — | `{ valid: boolean, reason?: 'invalid'\|'expired' }`. Lets the reset page show the invalid/expired state before the user types a password. |
| POST | `/api/auth/reset-password` | public | `{ token, password }` | Validate token (exists, not expired, not used). Enforce password ≥ 8 chars. Hash & save new password. **Invalidate the token** (single use). Optionally invalidate existing sessions. Return `{ success: true }`. |

**Token storage (backend):** store a `PasswordResetToken` record — `{ userId, tokenHash, expiresAt, usedAt }`
(hash the token, never store it in plaintext). Or store the hash on the user document. Clean up expired tokens.

**Email:** send via the mailer service (§12) using a branded HTML template with the reset link button.
When `ANTHROPIC`/SMTP isn't configured in dev, log the link to the console so devs can test (mirrors the
frontend "Demo Mode" link surfacing).

> **Frontend swap note:** When you wire the real API, update `auth.js`:
> `forgotPassword` → `POST /auth/forgot-password` (drop the returned demo `token`; remove the "Demo Mode"
> link block in `ForgotPasswordView.vue`), `verifyResetToken` → `GET /auth/reset-password/verify`
> (it becomes async — the reset page should `await` it on mount), `resetPassword` →
> `POST /auth/reset-password`.

---

## 7. REST API — Full Endpoint Reference

Base path: **`/api`**. All list endpoints should support pagination (`?page=&limit=`),
but the frontend currently expects **plain arrays** for many calls — see §13 for the exact
expected shapes. Recommended: support both (`?paginated=true` for `{ data, total, page }`,
default to array to stay drop-in compatible — or update the stores accordingly).

### 7.1 Auth — `/api/auth`
| Method | Path | Auth | Body | Returns |
|---|---|---|---|---|
| POST | `/register` | public | `{ firstName, lastName, email, phone?, profession?, password, role? }` | `{ user, token }` |
| POST | `/login` | public | `{ email, password }` | `{ user, token }` |
| POST | `/logout` | auth | — | `{ success: true }` |
| GET | `/me` | auth | — | `{ user }` (current safe user; for session restore) |
| PATCH | `/me` | auth | partial user fields | `{ user }` |
| POST | `/become-instructor` | auth | `{ title, experience, courseTopic, category, linkedin, bio }` | `{ user }` (role now instructor) |
| POST | `/forgot-password` | public | `{ email }` | `{ success }` (neutral, no account enumeration; emails reset link) |
| GET | `/reset-password/verify?token=` | public | — | `{ valid, reason? }` (validate link before showing form) |
| POST | `/reset-password` | public | `{ token, password }` | `{ success }` (single-use token, password ≥ 8) |

### 7.2 Courses — `/api/courses`
| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/` | public/auth | List/search/filter. **Only returns `status: 'published'` courses.** Query: `q, category, level, sort` (sort: `popular|rating|newest|price-low|price-high`). Returns courses array. |
| GET | `/featured` | public | `featured === true` **AND `status === 'published'`**. |
| GET | `/:id` | auth | Single course (full, with sections/lectures). |
| POST | `/` | instructor | Create/submit course (from CreateCourse form). Sets `instructorId`, `status:'pending'`, `submittedAt`, defaults `enrolledCount:0, rating:0, reviewCount:0, featured:false`. **The course is NOT public until an admin approves it** (see §7.10). Returns created course. |
| PATCH | `/:id` | instructor (owner) or admin | Update course; bump `lastUpdated`. |
| DELETE | `/:id` | instructor (owner) or admin | Delete/unpublish. |
| GET | `/instructor/:instructorId` | auth | Courses by instructor (matches `instructor.id` OR `instructorId`). |
| GET | `/:id/reviews` | public | Reviews for a course. |
| POST | `/:id/reviews` | auth (enrolled) | `{ rating, comment }` (+ userName from token). Recomputes course rating/reviewCount. |

**Filtering semantics (match `lms.js` exactly):**
- `q` matches title, subtitle, any tag, or category (case-insensitive).
- `category`/`level` exact match unless `'All'`.
- sort options exactly as listed above.

### 7.3 Enrollments & Progress — `/api/enrollments`, `/api/progress`
| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/api/enrollments` | auth | `{ courseId }`. For **free courses** enroll directly. For paid, enrollment happens via payment (§9). Idempotent (no duplicate). |
| GET | `/api/enrollments/me` | auth | Current user's enrolled courses, each merged with `progress` and `enrolledAt` (this powers StudentDashboard — see `getEnrolledCourses`). |
| GET | `/api/enrollments/check?courseId=` | auth | `{ enrolled: boolean }`. |
| GET | `/api/progress?courseId=` | auth | `{ completedLectures, percentage, completedAt }`. |
| POST | `/api/progress/complete` | auth | `{ courseId, lectureId }`. Marks a lecture complete, recomputes percentage, sets `completedAt` at 100%, may trigger certificate eligibility. Returns updated progress. |

### 7.4 Cart & Wishlist — `/api/cart`, `/api/wishlist`
The cart/wishlist are currently **pure client-side** (localStorage `fe_cart`, `fe_wishlist`).
**You may leave them client-side** (simplest, zero backend) **or** persist them server-side for
cross-device sync. If you persist:
| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/api/cart` | auth | Items: `{ courseId, title, instructor, price, originalPrice, thumbnail, rating, duration }`. |
| POST | `/api/cart` | auth | `{ courseId }` add. |
| DELETE | `/api/cart/:courseId` | auth | remove. |
| DELETE | `/api/cart` | auth | clear. |
| GET/POST/DELETE | `/api/wishlist` | auth | same pattern. |

> **Recommendation:** Keep cart/wishlist client-side for v1 (no behaviour change). Persisting is a nice-to-have.

### 7.5 Jobs — `/api/jobs`
| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/` | auth | List active jobs. Query: `q, type, category, location, sort` (sort: `newest|popular|salary-high`). `q` matches title, company, any skill, category. **Only `isActive && status==='approved'`.** |
| GET | `/featured` | auth | `isFeatured && isActive`, first 6. |
| GET | `/internships` | auth | `type === 'Internship' && isActive`. |
| GET | `/:id` | auth | Single job. Increment `views`. |
| POST | `/` | auth | Submit a job (PostJob form). Sets `postedBy`, `applications:0, views:0, isActive:false, isFeatured:false, status:'pending', submittedAt, postedAt: today`. **Not public until an admin approves it** (see §7.10). |
| PATCH | `/:id` | owner or admin | **Full edit of a job by its poster** (or admin). Powers `/jobs/edit/:id` (the PostJob form in edit mode) — accepts the same body as `POST /` (title, company, category, type, locationType, level, location, description, responsibilities, requirements, skills, benefits, salary, deadline) plus the lighter admin toggles (activate/deactivate, feature). **Authorize: `job.postedBy === req.user.id` OR admin.** Editing keeps the current `status` (it does not reset to `pending`); if you want material edits to require re-approval, set `status:'pending', isActive:false` server-side — note the frontend currently does NOT re-trigger approval on edit. |
| DELETE | `/:id` | owner or admin | Remove job. |

### 7.6 Applications — `/api/applications`

**Candidate-review workflow (BUILT in the frontend).** Reviewer model = **employer (who posted the job)
+ admin oversight**. Three pages now exist and consume these endpoints:
- **`/jobs/my-applications`** (`MyApplicationsView`) — the candidate tracks their own applications + status.
- **`/jobs/manage`** (`ManageJobsView`) — the **employer** sees the jobs they posted, can **edit each listing**
  (→ `/jobs/edit/:id`, the PostJob form in edit mode), expands each to review applicants (CV, cover letter,
  contact, links) and moves them through the pipeline.
- **Admin → Job Management** — an "Applicants (N)" button per job opens a modal with the same review UI,
  giving admin oversight of **every** job's applicants.
- Shared component: `src/components/jobs/ApplicantList.vue`. Store (`jobs.js`) exposes
  `getUserApplications`, `getJobApplications`, `getPostedJobs`, `getPosterApplications`,
  `updateApplicationStatus`.

**Application status pipeline:** `pending → reviewed → shortlisted → accepted | rejected` (the candidate
sees `pending` as "Under review").

| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/` | auth | `{ jobId, fullName, email, phone, location?, linkedin?, portfolio?, experience, coverLetter, cvName }` + optional CV file upload. Rejects duplicate (already applied → message `"You have already applied for this job"`). Sets `status:'pending'`. Increments job `applications`. |
| GET | `/me` | auth | Current user's applications, each merged with its `job` (powers `/jobs/my-applications`). |
| GET | `/check?jobId=` | auth | `{ applied: boolean }`. |
| GET | `/job/:jobId` | owner(employer) or admin | Applications for one job (powers the employer page & admin modal). Returns the full application objects incl. coverLetter, cvUrl, links, status. |
| GET | `/posted-by-me` | auth | All applications across jobs the current user posted, each merged with `job` (employer dashboard stats). Backend must scope to `job.postedBy === req.user.id`. |
| PATCH | `/:id/status` | owner(employer) or admin | `{ status }` where status ∈ `pending\|reviewed\|shortlisted\|accepted\|rejected`. Authorize: the job's poster OR an admin. Optionally email the candidate on change. |
| POST | `/upload-cv` | auth | multipart CV upload → `{ cvUrl, cvName }` (PDF/DOC/DOCX, max 5MB per UI). |

> **Authorization note:** `GET /job/:jobId` and `PATCH /:id/status` must verify the requester is either an
> **admin** or the **employer who posted that job** (`job.postedBy`). A candidate may only read their own
> applications via `/me`.

### 7.7 Videos — `/api/videos` (see §8 for full detail)
| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/upload` | instructor | Multipart direct upload (Pattern A). Returns the **VideoAsset** shape. |
| POST | `/create-upload` | instructor | (Pattern B) returns `{ uploadUrl, assetId }` for direct-to-provider upload. |
| GET | `/:assetId` | auth | Poll asset status `{ assetId, status, playbackUrl, thumbnail, duration, durationLabel }`. |

### 7.8 Quizzes — `/api/quizzes` (NEW — see QuizComponent)
Currently the quiz questions are **hardcoded** in `QuizComponent.vue` (3 sample corporate governance / law / M&A
questions, pass mark **70%**). For a real backend, store quizzes per lecture/course:
| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/course/:courseId/lecture/:lectureId` | auth (enrolled) | Quiz questions (without `correct` answers leaking, ideally). |
| POST | `/:quizId/submit` | auth | `{ answers: number[] }` → `{ score, passed }` (pass ≥ 70). |
Question shape: `{ question: string, options: string[], correct: number }`.

### 7.9 Certificates — `/api/certificates` (see §10)
| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/generate` | auth | `{ courseId }`. Only if course progress is 100% and `course.certificate === true`. Returns `{ id, pdfUrl, ... }`. |
| GET | `/me` | auth | User's certificates. |
| GET | `/:id` | public | Public verification + PDF link. |

### 7.10 Admin — `/api/admin`

**All admin endpoints require a valid JWT AND `req.user.role === 'admin'` (`adminOnly` middleware).**
Non-admins get `403 { error: { message: 'Admin access required', code: 'FORBIDDEN' } }`.
Unauthenticated requests get `401 { error: { message: 'Authentication required', code: 'UNAUTHENTICATED' } }`.

Quick index:
| Method | Path | Purpose |
|---|---|---|
| GET | `/api/admin/stats` | Dashboard summary (AdminDashboardView) |
| GET | `/api/admin/users` | List/search users (AdminUsersView) |
| GET | `/api/admin/users/:id` | Single user detail (modal) |
| PATCH | `/api/admin/users/:id` | Change role / suspend / reactivate |
| DELETE | `/api/admin/users/:id` | Remove user |
| GET | `/api/admin/courses` | List all courses incl. drafts/pending (AdminCoursesView) |
| POST | `/api/admin/courses/:id/approve` | **Approve a pending course → publish it** |
| POST | `/api/admin/courses/:id/reject` | **Reject a pending course (with reason)** |
| PATCH | `/api/admin/courses/:id` | Edit pricing / feature / publish / unpublish |
| DELETE | `/api/admin/courses/:id` | Remove course |
| GET | `/api/admin/jobs` | List all jobs incl. inactive/pending (AdminJobsView) |
| POST | `/api/admin/jobs/:id/approve` | **Approve a pending job → publish it** |
| POST | `/api/admin/jobs/:id/reject` | **Reject a pending job (with reason)** |
| PATCH | `/api/admin/jobs/:id` | Edit salary / feature / activate / deactivate |
| DELETE | `/api/admin/jobs/:id` | Remove job |
| GET | `/api/admin/payments` | Transactions list + summary (AdminPaymentsView) |
| GET | `/api/admin/payments/export` | CSV export ("Export CSV" button) |
| PATCH | `/api/admin/payments/:id` | Update order status (e.g. confirm bank transfer, refund) |
| GET | `/api/admin/analytics` | Chart data (AdminAnalyticsView) |

---

#### GET `/api/admin/stats`
Powers AdminDashboardView. No body. See §13.6 for the canonical shape — repeated here as a full example response.

**Response `200`:**
```json
{
  "totalUsers": 1530,
  "totalInstructors": 152,
  "totalParticipants": 1377,
  "totalCourses": 6,
  "totalEnrollments": 4820,
  "totalRevenue": 124580.50,
  "paidStudents": 1284,
  "totalJobs": 5,
  "totalApplications": 508,
  "internships": 2,
  "pendingCourses": 2,
  "pendingJobs": 1,
  "pendingApprovals": 3,
  "pageViews": 48239,
  "weeklyVisitors": 12847,
  "conversionRate": 3.2,
  "avgCourseRating": 4.7,
  "revenueByMonth": [
    { "month": "Jan", "revenue": 23000 }, { "month": "Feb", "revenue": 26000 }
    /* ...12 entries total, Jan..Dec */
  ],
  "enrollmentsByMonth": [
    { "month": "Jan", "count": 230 }, { "month": "Feb", "count": 260 }
    /* ...12 entries total */
  ],
  "topCourses": [
    { "id": "c001", "title": "Financing, M&A and ADR: Advanced Practice", "enrolledCount": 4200,
      "rating": 4.9, "price": 320, "thumbnail": "https://..." }
    /* top 5 by enrolledCount; full course objects are also acceptable */
  ],
  "recentActivity": [
    { "id": 1, "type": "enrollment", "message": "New participant enrolled in Company Secretarial Practice",
      "time": "2 minutes ago", "icon": "book" },
    { "id": 4, "type": "payment", "message": "Payment of $280 received for Capital Market course",
      "time": "1 hour ago", "icon": "currency" }
  ]
}
```
- `type` ∈ `enrollment|job|application|payment|user|certificate|review`.
- `icon` ∈ `book|briefcase|document|currency|user|badge|star`.
- `time`: send a human label ("2 minutes ago") OR an ISO timestamp and let the frontend format — be consistent.
- Compute totals from real collections; `pageViews/weeklyVisitors/conversionRate` can come from an analytics
  source or be stored counters (the mock hardcodes them).

---

#### GET `/api/admin/users`
Powers AdminUsersView table + stat row. Returns **safe users** (never include `password`).

**Query params:** `q` (matches firstName, lastName, email — case-insensitive), `role`
(`admin|instructor|participant`), optional `page`, `limit`.

**Response `200`** (array form keeps the current frontend drop-in; switch to `{ data, total }` only if you
also update the store):
```json
[
  {
    "id": "user-1718800000000",
    "firstName": "Chioma", "lastName": "Eze",
    "email": "chioma@email.com",
    "role": "participant",
    "avatar": null,
    "profession": "Corporate Lawyer",
    "phone": "+234 800 000 0000",
    "bio": "",
    "status": "active",
    "enrolledCourses": ["c001"],
    "completedCourses": [],
    "createdAt": "2026-02-22T09:14:00.000Z"
  }
]
```
> The view derives its stat cards client-side (Total Users / Instructors / Participants) by counting this
> array, so returning the full filtered list is sufficient. If you paginate, also return counts.

---

#### GET `/api/admin/users/:id`
Single safe user for the detail modal (shows id, joined date, profession).

**Response `200`:** one safe-user object (same shape as above).
**Errors:** `404 { error: { message: 'User not found', code: 'NOT_FOUND' } }`.

---

#### PATCH `/api/admin/users/:id`
Backs the "Change Role" and "Suspend" actions (currently stubbed in the UI). Partial update.

**Request body** (any subset):
```json
{ "role": "instructor", "status": "suspended" }
```
- `role` ∈ `participant|instructor|admin`.
- `status` ∈ `active|suspended` (a suspended user should be blocked at login).
- Guard rails: prevent an admin from demoting/suspending **themselves**; consider preventing removal of the
  last remaining admin.

**Response `200`:** the updated safe user.
**Errors:** `400` invalid enum, `403` self-demotion attempt, `404` not found.

---

#### DELETE `/api/admin/users/:id`
**Response `200`:** `{ "success": true, "id": "user-1718800000000" }`
- Soft-delete recommended (or cascade: remove their enrollments/progress/applications, or reassign).
- Block deleting yourself / the last admin (`403`).

---

#### GET `/api/admin/courses`
Powers AdminCoursesView. Returns **all** courses including `pending`, `draft` and `rejected` (unlike the
public `GET /api/courses` which returns only `published`). The view shows a pending-approvals banner +
status badge per course.

**Query params:** `q`, `category`, `status` (`draft|pending|published|rejected`), `featured` (`true|false`), `page`, `limit`.

**Response `200`:** array of full course objects (see §5.2), each additionally carrying management fields:
```json
[
  {
    "id": "c001",
    "title": "Financing, M&A and ADR: Advanced Practice, Procedure & Negotiation",
    "instructor": { "id": "inst-001", "name": "Barr. (Mrs.) Adaeze Okafor, SAN" },
    "category": "Dispute Resolution",
    "price": 320,
    "enrolledCount": 4200,
    "rating": 4.9,
    "status": "published",
    "featured": true,
    "lastUpdated": "2026-01-15",
    "thumbnail": "https://..."
  }
]
```

---

#### POST `/api/admin/courses/:id/approve`
Approve a `pending` course submitted by an instructor — makes it publicly visible. Powers the
"Approve" button in the AdminCoursesView pending-approvals banner & table.

**Request body:** none. **Response `200`:** the updated course (`status: 'published'`, `rejectionReason` cleared).
**Side effects:** the course now appears in public listings; optionally email the instructor.
**Errors:** `404` not found; `409` if not in an approvable state.

#### POST `/api/admin/courses/:id/reject`
Reject a `pending` course with feedback for the instructor.

**Request body:** `{ "reason": "Please add learning objectives and improve audio quality." }`
**Response `200`:** the updated course (`status: 'rejected'`, `rejectionReason` set). The instructor sees the
reason on their dashboard. Optionally email them. **Errors:** `404` not found.

#### PATCH `/api/admin/courses/:id`
Feature/unfeature, publish/unpublish, **and control pricing** from the admin table. The admin Course
Management page ("Edit Pricing" modal) lets an admin override a course's price, original price and
free/paid status — so this endpoint MUST accept pricing fields, not just status flags.

**Request body** (any subset):
```json
{ "isPaid": true, "price": 320, "originalPrice": 480, "featured": true, "status": "published" }
```
- `isPaid` boolean — when `false`, the backend should force `price` and `originalPrice` to `0`.
- `price` number ≥ 0 (USD). The amount students pay.
- `originalPrice` number ≥ `price` (the strike-through reference price).
- `featured` boolean (controls landing-page carousels).
- `status` ∈ `draft|published`.
- **Server-side validation:** clamp negatives to 0; if `isPaid === false` set both prices to 0; ensure
  `originalPrice >= price`. Pricing is authoritative on the server and is the figure used at checkout —
  never trust a client-sent price during payment (see §9), only this admin/instructor-managed value.

**Response `200`:** the updated course. **Errors:** `400` invalid value, `404` not found.

> **Who can set price:** both the **instructor** (via `PATCH /api/courses/:id`, owner-only — the
> CreateCourse pricing step) and the **admin** (here, any course) can set/override pricing. The admin
> value wins. The frontend `lms.js` exposes `updateCourse` (price/featured) and `deleteCourse`, used by
> both the instructor dashboard and the admin panel.

---

#### DELETE `/api/admin/courses/:id`
**Response `200`:** `{ "success": true, "id": "c001" }`
- Consider blocking hard-delete if the course has enrollments; prefer unpublish. If deleting, decide on
  cascade for enrollments/progress/reviews.

---

#### GET `/api/admin/jobs`
Powers AdminJobsView. Returns **all** jobs including `isActive: false`.

**Query params:** `q`, `category`, `type`, `isActive` (`true|false`), `isFeatured`, `page`, `limit`.

**Response `200`:** array of full job objects (see §5.6), e.g.:
```json
[
  {
    "id": "j001",
    "title": "Corporate / Commercial Lawyer",
    "company": "Adebayo & Okonkwo LP",
    "category": "Legal",
    "type": "Full-time",
    "location": "Lagos, Nigeria",
    "applications": 47,
    "views": 892,
    "isActive": true,
    "isFeatured": true,
    "postedBy": "user-hr-001",
    "postedAt": "2026-02-20",
    "deadline": "2026-03-31"
  }
]
```

---

#### POST `/api/admin/jobs/:id/approve`
Approve a `pending` job posted by an employer — sets `status: 'approved'`, `isActive: true` so it
appears in public listings. Powers the "Approve" button in AdminJobsView.

**Request body:** none. **Response `200`:** the updated job. Optionally email the employer. **Errors:** `404`.

#### POST `/api/admin/jobs/:id/reject`
Reject a `pending` job with feedback.

**Request body:** `{ "reason": "Listing is incomplete or violates posting guidelines." }`
**Response `200`:** the updated job (`status: 'rejected'`, `isActive: false`, `rejectionReason` set). **Errors:** `404`.

#### PATCH `/api/admin/jobs/:id`
Approve / feature / activate / deactivate **and adjust the salary amount**. The admin Job Management
page ("Edit" modal) lets an admin override the salary range, pay period and status — so this endpoint
must accept the `salary` object too.

**Request body** (any subset):
```json
{
  "salary": { "min": 450000, "max": 750000, "currency": "NGN", "period": "monthly" },
  "isActive": false,
  "isFeatured": true
}
```
- `salary.min` ≥ 0, `salary.max` ≥ `salary.min` (validate/clamp server-side).
- `salary.period` ∈ `monthly|yearly|hourly`; `currency` defaults to `NGN`.
- `isActive` / `isFeatured` booleans.

**Response `200`:** the updated job. **Errors:** `400` invalid salary range, `404` not found.

> Like courses, both the **poster/employer** (`PATCH /api/jobs/:id`, owner-only) and the **admin**
> (here) can edit a job's amounts/status. Frontend `jobs.js` exposes `updateJob` and `deleteJob`.

---

#### DELETE `/api/admin/jobs/:id`
**Response `200`:** `{ "success": true, "id": "j001" }`
- Prefer setting `isActive: false`; if hard-deleting, decide on cascade for that job's applications.

---

#### GET `/api/admin/payments`
Powers AdminPaymentsView (summary cards + transactions table). Derive from the `Order` collection
(§5.8) but **map to the exact shape the table renders**.

**Query params:** `q` (student name/email), `status` (`completed|pending|refunded`), `from`, `to` (dates),
`page`, `limit`.

**Response `200`:**
```json
{
  "summary": {
    "totalRevenue": 124580.00,
    "paidStudents": 1284,
    "avgOrderValue": 76.40,
    "thisMonth": 58200.00
  },
  "transactions": [
    {
      "id": "TXN-001-2026",
      "student": "Chioma Eze",
      "email": "chioma@email.com",
      "course": "Financing, M&A and ADR: Advanced Practice",
      "amount": "320",
      "date": "2026-06-14",
      "status": "completed"
    }
  ]
}
```
- **`status` mapping:** the Order model uses `paid|pending|failed|refunded`; the table expects
  `completed|pending|refunded`. Map `paid → completed` (and either omit `failed` or surface it as `refunded`/
  a new badge). `amount` is rendered with a `$` prefix as a string. `course` is the first/primary item title
  (an order may contain multiple items — show the first or a "+N more").
- If you keep it simple, returning just `transactions` (array) is acceptable since the current UI hardcodes
  the summary cards — but returning `summary` lets you make those cards real.

---

#### GET `/api/admin/payments/export`
Backs the "Export CSV" button. Returns `text/csv` with
`Content-Disposition: attachment; filename="transactions.csv"`. Columns:
`Transaction ID, Student, Email, Course, Amount, Date, Status`. Honors the same query filters as
`GET /api/admin/payments`.

---

#### PATCH `/api/admin/payments/:id`
Update an order's status — e.g. confirm a manual **bank transfer** (`pending → paid`, which then triggers
enrollment fulfillment) or process a **refund**.

**Request body:**
```json
{ "status": "paid" }
```
- `status` ∈ `pending|paid|failed|refunded`.
- On `paid`: create enrollments for each item, increment course `enrolledCount`, send confirmation email
  (idempotent — don't double-fulfill).
- On `refunded`: optionally revoke enrollment(s) and trigger the gateway refund.

**Response `200`:** the updated order. **Errors:** `400` invalid transition, `404` not found.

---

#### GET `/api/admin/analytics`
Powers AdminAnalyticsView charts. Return precomputed series matching what the view renders.

**Query params:** `range` (e.g. `12m` default, `30d`, `7d`).

**Response `200`:**
```json
{
  "keyMetrics": {
    "pageViews":      { "value": 48239, "change": 18 },
    "uniqueVisitors": { "value": 12847, "change": 12 },
    "newEnrollments": { "value": 1284,  "change": 23 },
    "revenueMTD":     { "value": 58200, "change": 15 }
  },
  "enrollmentTrend": [
    { "month": "Jan", "count": 120 }, { "month": "Feb", "count": 180 }
    /* ...12 entries */
  ],
  "revenueByCategory": [
    { "name": "Mergers & Acquisitions", "pct": 28 },
    { "name": "Corporate Governance", "pct": 24 },
    { "name": "Finance & Capital Markets", "pct": 20 },
    { "name": "Taxation", "pct": 16 },
    { "name": "Energy & ESG", "pct": 12 }
  ],
  "trafficSources": [
    { "name": "Organic Search", "pct": 42 },
    { "name": "Social Media", "pct": 28 },
    { "name": "Direct", "pct": 18 },
    { "name": "Referral", "pct": 12 }
  ],
  "demographics": [
    { "country": "Nigeria", "pct": 45 },
    { "country": "Ghana", "pct": 18 },
    { "country": "Kenya", "pct": 14 },
    { "country": "South Africa", "pct": 12 },
    { "country": "Others", "pct": 11 }
  ],
  "funnel": [
    { "label": "Visitors", "value": 48239 },
    { "label": "Sign Ups", "value": 12847 },
    { "label": "Course Views", "value": 6420 },
    { "label": "Add to Cart", "value": 2840 },
    { "label": "Purchases", "value": 1284 }
  ]
}
```
- `change` is a percentage delta vs. the previous period (UI renders it as a green `+N%` badge).
- `pct` values are percentages (the bars are widths). `change` colors are computed client-side.
- `trafficSources`/`demographics`/`funnel` require real analytics instrumentation; until that exists you may
  return reasonable computed approximations (e.g. funnel from users/enrollments/orders counts).

---

**Admin error & validation conventions (all admin routes):**
- `400` invalid/missing fields → `{ error: { message, code: 'VALIDATION', fields?: {...} } }`
- `401` no/invalid token, `403` not admin, `404` resource missing.
- Validate every enum (`role`, `status`, `featured`, etc.) and reject unknown values.
- Consider an **audit log** entry for every mutating admin action (who/what/when) — see optional model below.

#### (Optional) AdminAuditLog model
```js
AdminAuditLog {
  id: string,
  adminId: string,          // who performed it
  action: string,           // 'user.role.update' | 'course.delete' | 'payment.refund' | ...
  targetType: string,       // 'user' | 'course' | 'job' | 'order'
  targetId: string,
  changes: object,          // before/after diff
  createdAt: ISODate
}
```

---

## 8. Video Upload & Streaming Architecture

**This is the most carefully-designed seam in the frontend.** Read `src/services/videoService.js`
— it is the *only* module that talks to the video backend, and it documents the exact contract.

### The VideoAsset contract (what `/api/videos/upload` must return)
```js
VideoAsset {
  assetId: string,        // server id for the video
  source: 'upload' | 'url',
  status: 'processing' | 'ready',
  originalName: string,
  size: number,           // bytes
  duration: number,       // seconds
  durationLabel: string,  // 'mm:ss' or 'h:mm:ss'
  thumbnail: string,      // poster image URL
  playbackUrl: string     // HLS (.m3u8) or MP4 URL the <video> can play
}
```

### Two supported upload patterns (frontend already codes both)
- **Pattern A — direct multipart** (`realUpload()` in videoService):
  Frontend does `POST {API_BASE}/api/videos/upload` with `FormData { file }` via XHR (for progress).
  Your endpoint: accept the file (Multer), push to the video provider, return the VideoAsset JSON.
- **Pattern B — presigned/direct-to-provider (recommended at scale):**
  1. `POST /api/videos/create-upload` → `{ uploadUrl, assetId }`
  2. Frontend PUTs the file straight to `uploadUrl` (Mux/Cloudflare/S3).
  3. Frontend polls `GET /api/videos/:assetId` until `status === 'ready'`.

### Activation
- Frontend auto-detects mock vs real via `VITE_API_BASE_URL`. **When that env var is set, the
  frontend automatically calls your real endpoints** — no other frontend change needed for video.
- `VITE_VIDEO_PROVIDER` (`mux | cloudflare-stream | s3`) is informational on the frontend; the
  actual provider choice lives in your backend.

### Recommended provider behaviour
- **Mux**: create a direct upload (`mux.video.uploads.create`), return its `url` + asset id (Pattern B).
  Webhook `video.asset.ready` flips status to `ready`, store `playbackUrl` = `https://stream.mux.com/<PLAYBACK_ID>.m3u8`.
- **Cloudflare Stream**: `POST .../stream?direct_user=true` for tus/direct upload; poll `readyToStream`.
- **S3 + transcode**: presigned `PUT`, then MediaConvert → HLS in a CDN bucket.
- Always generate a **thumbnail/poster** server-side (the mock does it in-browser via canvas; a real
  provider returns one).

### Other uploads
- **Course thumbnail**: CreateCourse currently base64-encodes the image into `form.thumbnail`. Provide
  `POST /api/uploads/image` → `{ url }` and have the frontend store the URL instead (small change).
- **CV/Resume**: `POST /api/applications/upload-cv` (PDF/DOC/DOCX ≤ 5MB).
- **Avatar / company logo**: image upload endpoints.

---

## 9. Payments & Checkout

### Frontend behaviour (`CheckoutView.vue`)
- Collects **billing**: `{ firstName, lastName, email, country }` (countries: Nigeria, Ghana, Kenya,
  South Africa, United States, United Kingdom).
- **Payment methods**: `card` (number/expiry/CVV/name), `paypal` (redirect), `bank` (manual transfer
  details shown).
- On "Complete Purchase": currently fakes a 2s delay, then enrolls the user in **every cart course**,
  clears the cart, shows success ("A confirmation email has been sent to …").
- Prices are **USD**. `subtotal`, `savings` (= Σ originalPrice − price), `total`.

### Backend to build
1. `POST /api/payments/initialize` — `{ items:[courseId...], paymentMethod, billing }` → creates a
   `pending` Order, returns the gateway init payload (e.g. Paystack `authorization_url` + `reference`,
   or Stripe PaymentIntent `client_secret`).
2. **Card/Paystack/Stripe**: redirect/confirm on the gateway.
3. `POST /api/payments/verify` — `{ reference }` → verify with gateway, mark Order `paid`, create
   Enrollments for each item, increment `enrolledCount`, send confirmation email. Returns enrolled courses.
4. **Webhook**: `POST /api/payments/webhook/paystack` (and/or stripe) — authoritative confirmation;
   idempotently fulfill the order.
5. **Bank transfer**: create order as `pending`, show bank details, admin marks paid manually
   (`PATCH /api/admin/payments/:id` → `paid`).

> **Recommendation:** Use **Paystack** as the primary gateway (best for NGN + cards + bank in Nigeria).
> Add Stripe if international cards are needed. Convert USD↔NGN if charging in NGN, or charge USD directly.
> **Never** trust the client's price — recompute totals server-side from the course records.

### AdminPayments view
Expects a list of transactions/orders with amounts, methods, statuses, dates. Back it with the `orders` collection.

---

## 10. Certificates

From `CourseLearnView.vue`:
- A **"Get Certificate"** button appears (gated on course completion / `course.certificate`).
- Shows a certificate modal with the learner name, course title, and an ID:
  `FE-{COURSEID}-{USERID last 6}` (uppercased).
- **"Download Certificate"** currently just toasts success.

Backend:
- `POST /api/certificates/generate { courseId }` — verify progress === 100% and `course.certificate`,
  create a `Certificate` record, **render a PDF** (e.g. `pdfkit` or `puppeteer` from an HTML template
  using the purple/gold theme), store it (S3/Cloudinary), return `{ id, pdfUrl }`.
- `GET /api/certificates/:id` — public verification page/endpoint.
- Optionally email the certificate on issue.

---

## 11. AI Career Assistant

From `components/ai/AIAssistant.vue`: a floating chat widget. Currently uses **hardcoded keyword
matching** (courses/jobs/instructor/lms/default) with canned replies + quick-action buttons that route
within the app.

**Backend upgrade (recommended):**
- `POST /api/assistant/chat` — `{ messages: [{role, content}], context? }` →
  `{ reply: string, quickActions?: [{ label, path }] }`.
- Implement with the **Anthropic Claude API** (`@anthropic-ai/sdk`). Use a system prompt describing
  Formation Exceptionelle (a professional corporate/legal/finance training & career platform: expert-led
  programmes in corporate law, finance & capital markets, M&A, governance, tax, energy/ESG and dispute
  resolution; a jobs board; an instructor/faculty program; certificates; payments) and instruct the model
  to optionally suggest in-app navigation (`/lms`, `/jobs`, `/become-instructor`) as quick actions.
- Recommended model: **`claude-haiku-4-5`** for low-latency/cheap chat, or **`claude-opus-4-8`** for
  best quality. Stream tokens if you want the typing effect.
- Optionally ground answers with real data (call your own courses/jobs endpoints, or use tool-use) so it
  can answer "what M&A or tax courses do you have?" accurately.
- Keep the existing canned responses as a **fallback** when the API key is missing.

> If you keep it simple for v1, a stateless endpoint that proxies Claude with a good system prompt is enough.

---

## 12. Email / Notifications

Triggered moments observed in the frontend (send transactional emails for these):
- **Welcome** on register (`"Welcome to Formation Exceptionelle, <name>!"`).
- **Enrollment / payment confirmation** ("A confirmation email has been sent to …").
- **Job application submitted** ("hiring team will review … within 5-7 business days").
- **Instructor application** outcome.
- **Certificate issued**.
- **Password reset**.
- **Contact form** submission (ContactSection on landing page) → notify admin / store as a lead.

Use Nodemailer (SMTP) or Resend/SendGrid. Build a small `mailer` service + HTML templates in the
brand colors. Also consider a `POST /api/contact` endpoint for the landing-page contact form.

### 12.1 Legal / Static Pages (BUILT in the frontend — backend optional)
The legal pages now **exist in the frontend** (added after the initial mock). The previously-dead
`href="#"` links for Terms / Privacy / Cookie / Instructor Agreement are now real routes:

- `/terms` → Terms of Service
- `/privacy` → Privacy Policy
- `/cookies` → Cookie Policy
- The footer (Privacy/Terms/Cookie), the Login & Register "Terms of Service / Privacy Policy" lines,
  and the BecomeInstructor "Instructor Agreement" link all point here now.

**Implementation:** all three render from one component `src/views/legal/LegalView.vue`, driven by the
route's `meta.doc` (`'terms' | 'privacy' | 'cookies'`). The copy lives **statically** in
`src/views/legal/legalContent.js` (`LEGAL_DOCS`), so **no backend is required** for these pages — they
are content, not data.

**Backend (optional, only if you want CMS-style editable policies):**
| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/api/legal/:slug` | public | `slug ∈ terms\|privacy\|cookies` → `{ title, lastUpdated, intro, sections }`. |
| PUT | `/api/legal/:slug` | admin | Update policy copy. |

If you build these, change `LegalView.vue` to fetch by slug instead of importing `legalContent.js`.
Otherwise, leave the pages as-is. **Note:** the placeholder copy is a template — have it reviewed by
legal counsel before launch.

---

## 13. Frontend Integration Contract

This section tells you **exactly** what the frontend expects so the swap is seamless.

### 13.1 The swap strategy
The frontend's Pinia stores currently contain the mock logic. To go live, each store function should
call your API via **axios** instead of touching `localStorage`. Create `src/services/api.js`:
```js
import axios from 'axios'
const api = axios.create({ baseURL: import.meta.env.VITE_API_BASE_URL + '/api' })
api.interceptors.request.use(cfg => {
  const token = localStorage.getItem('fe_token')
  if (token) cfg.headers.Authorization = `Bearer ${token}`
  return cfg
})
export default api
```
Then refactor stores to `await api.post('/auth/login', ...)` etc. **The video service already does this
automatically** when `VITE_API_BASE_URL` is set.

### 13.2 Auth responses must match
- Login/Register must return **`{ user, token }`** where `user` is the safe user (no password).
- The frontend stores `user` → `localStorage.fe_user`, `token` → `localStorage.fe_token`.
- Computed flags the frontend derives from `user`: `isAuthenticated` (token+user present),
  `isAdmin` (`role==='admin'`), `isInstructor` (`role` instructor or admin), `fullName`
  (`firstName lastName`), `initials`.

### 13.3 Courses
- `GET /courses` returns an **array** of full course objects (frontend filters/sorts client-side today,
  but ideally move filtering server-side using the query params in §7.2).
- A course object must include nested `sections[].lectures[]` and the denormalized `instructor` object
  (frontend reads `course.instructor.name`, `.rating`, `.students`).
- `getEnrolledCourses` shape (StudentDashboard): each item = full course **plus** `progress`
  (`{ completedLectures, percentage, completedAt? }`) and `enrolledAt`.

### 13.4 Jobs
- `GET /jobs` returns array; frontend reads `job.salary.{min,max,currency,period}`, `job.skills[]`,
  `job.company[0]` (first letter for the logo placeholder), `applications`, `views`.
- `getUserApplications` shape: each application **plus** its `job` object nested.

### 13.5 Toast messages (keep parity for UX)
The frontend shows specific toasts; your API error messages should be human-readable and the store
should surface them. Key strings already in use: `"Invalid email or password"`,
`"An account with this email already exists"`, `"Successfully enrolled in course!"`,
`"You have already applied for this job"`, `"Course submitted for review! An admin will approve it
shortly."`, `"Job submitted for review! An admin will approve it shortly."`, `"Course approved and
published!"`, `"Course removed successfully"`, etc.

### 13.6 Admin stats object (exact shape expected by AdminDashboard via `admin.js`)
```js
{
  totalUsers, totalInstructors, totalParticipants,
  totalCourses, totalEnrollments, totalRevenue, paidStudents,
  totalJobs, totalApplications, internships,
  pendingCourses, pendingJobs, pendingApprovals,   // moderation queue counts (sum shown on dashboard alert)
  pageViews, weeklyVisitors, conversionRate, avgCourseRating,
  revenueByMonth: [{ month: 'Jan', revenue: number }, ...12],
  enrollmentsByMonth: [{ month: 'Jan', count: number }, ...12],
  topCourses: [ ...top 5 courses by enrolledCount ],
  recentActivity: [{ id, type, message, time, icon }, ...]
}
```
`type` ∈ `enrollment|job|application|payment|user|certificate|review`; `icon` is a string key
(`book|briefcase|document|currency|user|badge|star`). `time` is a human label ("2 minutes ago") —
you can compute relative time server-side or send ISO and let the frontend format.

### 13.7 IDs & dates
- Always serialize a string `id`. `lastUpdated`/`postedAt`/`deadline` are `'YYYY-MM-DD'` strings;
  `createdAt`/`enrolledAt`/`appliedAt` are ISO datetime strings. Keep these formats.

---

## 14. Recommended Project Structure

```
backend/
├── src/
│   ├── server.js                 # app entry (express, middleware, routes, error handler)
│   ├── config/
│   │   ├── db.js                 # Mongoose connection
│   │   └── env.js                # validated env config
│   ├── models/
│   │   ├── User.js
│   │   ├── Course.js             # with embedded Section/Lecture subschemas
│   │   ├── Enrollment.js
│   │   ├── Progress.js
│   │   ├── Review.js
│   │   ├── Job.js
│   │   ├── Application.js
│   │   ├── Order.js
│   │   ├── Certificate.js
│   │   └── Quiz.js
│   ├── middleware/
│   │   ├── auth.js               # authRequired, adminOnly, instructorOnly, ownerOrAdmin
│   │   ├── validate.js           # zod/joi wrapper
│   │   ├── upload.js             # multer config
│   │   └── error.js              # central error handler
│   ├── controllers/
│   │   ├── authController.js
│   │   ├── courseController.js
│   │   ├── enrollmentController.js
│   │   ├── jobController.js
│   │   ├── applicationController.js
│   │   ├── videoController.js
│   │   ├── paymentController.js
│   │   ├── certificateController.js
│   │   ├── assistantController.js
│   │   └── adminController.js
│   ├── routes/
│   │   └── *.routes.js           # one per resource, mounted under /api
│   ├── services/
│   │   ├── videoProvider.js      # Mux/Cloudflare/S3 abstraction
│   │   ├── paymentProvider.js    # Paystack/Stripe abstraction
│   │   ├── mailer.js
│   │   ├── certificatePdf.js
│   │   └── ai.js                 # Anthropic Claude client
│   ├── utils/
│   │   ├── jwt.js
│   │   ├── asyncHandler.js
│   │   └── relativeTime.js
│   └── seed/
│       └── seed.js               # admin user + demo courses/jobs (see §16)
├── .env
├── .env.example
├── package.json
└── README.md
```

---

## 15. Environment Variables

**Backend `.env`:**
```
# Server
PORT=5000
NODE_ENV=development
CLIENT_ORIGIN=http://localhost:5173        # for CORS (Vite dev server)

# Database
MONGODB_URI=mongodb://localhost:27017/formation_exceptionelle

# Auth
JWT_SECRET=replace-with-long-random-string
JWT_EXPIRES_IN=7d
BCRYPT_ROUNDS=12

# Admin seed
SEED_ADMIN_EMAIL=admin@formationexceptionelle.com
SEED_ADMIN_PASSWORD=Admin@2024!

# Video provider (mux | cloudflare-stream | s3)
VIDEO_PROVIDER=mux
MUX_TOKEN_ID=
MUX_TOKEN_SECRET=
MUX_WEBHOOK_SECRET=
# (or) CLOUDFLARE_ACCOUNT_ID=, CLOUDFLARE_STREAM_TOKEN=
# (or) AWS_ACCESS_KEY_ID=, AWS_SECRET_ACCESS_KEY=, AWS_REGION=, S3_BUCKET=

# Image / file storage
CLOUDINARY_URL=
# (or AWS S3 as above)

# Payments
PAYMENT_PROVIDER=paystack
PAYSTACK_SECRET_KEY=
PAYSTACK_PUBLIC_KEY=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=

# Email
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
MAIL_FROM="Formation Exceptionelle <no-reply@formationexceptionelle.com>"
# (or RESEND_API_KEY=)

# AI assistant
ANTHROPIC_API_KEY=
AI_MODEL=claude-haiku-4-5
```

**Frontend `.env.local` (already documented in repo `.env.example`):**
```
VITE_API_BASE_URL=http://localhost:5000     # setting this switches the frontend off mock mode
VITE_VIDEO_PROVIDER=mux                       # informational
```
> Note: the frontend builds video URLs as `${VITE_API_BASE_URL}/api/videos/...`, so set
> `VITE_API_BASE_URL` to the **origin only** (no trailing `/api`). Mount your routes at `/api`.

---

## 16. Seed Data

Create a seed script that runs once on an empty DB.

**Admin user (must exist — frontend documents these credentials):**
```
firstName: Admin, lastName: User
email: admin@formationexceptionelle.com
password: Admin@2024!   (hash it)
role: admin
bio: 'Platform Administrator'
```

**Demo courses (9):** Port `MOCK_COURSES` from `src/stores/lms.js` verbatim (ids `c001`–`c009`) —
professional corporate/legal/finance programmes: Financing, M&A & ADR; Company Secretarial Practice;
Strategic Leadership & Corporate Governance; Navigating Law & Digital Innovation (AI, Fintech & Data
Protection); Capital Market: Corporate Financing, Regulations & Compliance; Project Structuring &
Financing with ESG Integration; Mergers & Acquisitions: Regulations & Risk; Due Diligence & Contractual
Risk Management; The New Tax Laws. They include full nested sections/lectures with sample video URLs
(Google sample bucket) — keep them for a populated demo. Prices are in USD ($180–$360).

**Demo jobs (5):** Port `MOCK_JOBS` from `src/stores/jobs.js` (ids `j001`–`j005`):
Corporate/Commercial Lawyer, Legal & Compliance Intern, Company Secretary/Governance Officer,
Tax Manager, Investment/Capital Markets Analyst Intern.

> **Seed-version note:** the frontend stores re-seed cached `localStorage` data when a version key
> changes (`fe_courses_version`, `fe_jobs_version`). The real backend doesn't need this, but it's why
> the catalog shapes/categories below are authoritative.

> These exact mock arrays are in the frontend files referenced — copy them so the live app looks
> identical to the demo on day one.

---

## 17. Security, Validation & Non-Functional Requirements

- **Hash passwords** with bcrypt; never return `password` in any payload (the mock already strips it).
- **Validate every request body** (Zod/Joi). Enforce: email format, password ≥ 8, enum fields
  (role, level, job type, etc.), price ≥ 0.
- **Authorization** on every protected route; verify resource ownership for edits (course owner,
  application owner, job poster).
- **Server-authoritative pricing** in checkout (never trust client totals).
- **Rate limit** auth and AI endpoints. **helmet**, **cors** (allow `CLIENT_ORIGIN`),
  **express-mongo-sanitize**, body size limits.
- **File upload limits & type checks**: videos (large, video/* only), images (≤2MB), CV (≤5MB,
  pdf/doc/docx).
- **Idempotency** on enrollment, application, and payment fulfillment (unique compound indexes +
  webhook idempotency keys).
- **CORS**: the Vite dev server runs on `http://localhost:5173`.
- **Pagination & indexes** on list endpoints (courses, jobs, users, applications, orders).
- **Consistent error shape**: `{ error: { message, code? } }`, correct HTTP status codes.
- **Logging** + centralized error handler. **Health check**: `GET /api/health`.

---

## 18. Suggested Build Order / Milestones

1. **Foundation**: project setup, env, Mongoose connection, Express app, health check, error handler, CORS.
2. **Auth**: User model, register/login/me/logout, JWT, bcrypt, middleware (auth/admin/instructor),
   seed admin. → Verify frontend login/register works against the API.
3. **Courses (read)**: Course model + seed 6 demo courses, list/featured/detail with filtering+sort.
   → Verify LMS browse + course detail.
4. **Enrollments & Progress**: enroll (free), my-learning, progress complete. → Verify StudentDashboard + CourseLearn.
5. **Reviews**, **Instructor course CRUD** (create/edit/delete, instructor dashboard).
6. **Video uploads**: pick provider, implement `/api/videos/*` to the VideoAsset contract. → Verify VideoUploader + playback.
7. **Jobs & Applications**: models + seed 5 jobs, list/filter/detail/post, apply + CV upload, my applications.
8. **Payments**: Paystack init/verify/webhook, Order model, paid-course fulfillment → enrollments + email.
9. **Certificates**: generate + PDF + verify.
10. **Admin**: stats aggregation, user/course/job management, payments list, analytics.
11. **AI assistant**: Claude-backed `/api/assistant/chat` with fallback.
12. **Email/notifications**, contact form, password reset.
13. **Hardening**: validation, rate limiting, indexes, tests, OpenAPI docs, deployment (Docker/PM2).

---

### Appendix A — Complete enum/constant reference (copy into a `constants.js`)
```
ROLES               = ['participant', 'instructor', 'admin']
COURSE_CATEGORIES   = ['Corporate Law','Finance & Capital Markets','Mergers & Acquisitions','Corporate Governance','Taxation','Energy & ESG','Dispute Resolution']
COURSE_LEVELS       = ['Beginner','Intermediate','Advanced','All Levels']
COURSE_LANGUAGES    = ['English','French','Yoruba','Hausa','Igbo']
LECTURE_TYPES       = ['video','quiz','assignment']
COURSE_SORTS        = ['popular','rating','newest','price-low','price-high']
JOB_CATEGORIES      = ['Legal','Finance','Compliance & Risk','Corporate Governance','Tax','Energy & Resources','Consulting']
JOB_TYPES           = ['Full-time','Part-time','Internship','Contract','Freelance']
JOB_LOCATION_TYPES  = ['Remote','On-site','Hybrid']
JOB_LEVELS          = ['Entry','Mid-level','Senior','Manager']
JOB_SORTS           = ['newest','popular','salary-high']
SALARY_PERIODS      = ['monthly','yearly','hourly']
APPLICATION_STATUS  = ['pending','reviewed','shortlisted','rejected','accepted']
APPLICATION_EXPERIENCE = ['Less than 1 year','1-2 years','3-5 years','5-10 years','10+ years']
PAYMENT_METHODS     = ['card','paypal','bank']
ORDER_STATUS        = ['pending','paid','failed','refunded']
CHECKOUT_COUNTRIES  = ['Nigeria','Ghana','Kenya','South Africa','United States','United Kingdom']
QUIZ_PASS_MARK      = 70
```

### Appendix B — localStorage keys the mock used (for migration reference)
`fe_user`, `fe_token`, `fe_users`, `fe_courses`, `fe_enrollments`, `fe_progress`, `fe_reviews`,
`fe_cart`, `fe_wishlist`, `fe_jobs`, `fe_applications`, `fe_reset_tokens` (password-reset tokens).

---

*End of specification. This document fully describes the Formation Exceptionelle backend required to
serve the existing Vue 3 frontend. Build to the shapes in §5 and §13 and the app will work without
frontend rewrites (only store internals + axios wiring change; the video layer auto-switches on
`VITE_API_BASE_URL`).*
