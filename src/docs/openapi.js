import env from '../config/env.js';

/**
 * Hand-maintained OpenAPI 3.0 description of the public API surface. Served as
 * JSON at /api/openapi.json and rendered with Swagger UI at /api/docs.
 * Covers the endpoint groups the frontend consumes; request/response details
 * are summarised rather than exhaustively typed.
 */
const bearer = [{ bearerAuth: [] }];

export function buildOpenApiSpec() {
  return {
    openapi: '3.0.3',
    info: {
      title: 'Formation Exceptionelle API',
      version: '1.0.0',
      description:
        'LMS + Jobs + Admin backend. All monetary amounts are in Nigerian Naira (NGN). ' +
        'Auth is JWT bearer. External providers (Paystack, Bunny Stream, Cloudflare R2, Resend) ' +
        'activate via env vars and fall back to mock/local when unset.',
    },
    servers: [
      { url: '/api', description: 'Current origin' },
      { url: `http://localhost:${env.PORT}/api`, description: 'Local dev' },
    ],
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      },
    },
    tags: [
      { name: 'Auth' }, { name: 'Courses' }, { name: 'Enrollments' },
      { name: 'Progress' }, { name: 'Reviews' }, { name: 'Jobs' },
      { name: 'Applications' }, { name: 'Payments' }, { name: 'Videos' },
      { name: 'Certificates' }, { name: 'Quizzes' }, { name: 'Uploads' },
      { name: 'Contact' }, { name: 'Admin' },
    ],
    paths: {
      '/health': { get: { tags: ['Auth'], summary: 'Health check', responses: { 200: { description: 'OK' } } } },

      '/auth/register': { post: { tags: ['Auth'], summary: 'Register (creates a participant)', responses: { 201: { description: 'User + token' } } } },
      '/auth/login': { post: { tags: ['Auth'], summary: 'Login', responses: { 200: { description: 'User + token' }, 401: { description: 'Invalid credentials' } } } },
      '/auth/logout': { post: { tags: ['Auth'], summary: 'Logout (stateless no-op)', security: bearer, responses: { 200: { description: 'OK' } } } },
      '/auth/me': {
        get: { tags: ['Auth'], summary: 'Current user', security: bearer, responses: { 200: { description: 'User' } } },
        patch: { tags: ['Auth'], summary: 'Update profile', security: bearer, responses: { 200: { description: 'User' } } },
      },
      '/auth/become-instructor': { post: { tags: ['Auth'], summary: 'Upgrade to instructor', security: bearer, responses: { 200: { description: 'User' } } } },
      '/auth/forgot-password': { post: { tags: ['Auth'], summary: 'Request reset link (neutral response)', responses: { 200: { description: 'OK' } } } },
      '/auth/verify-reset-token': { get: { tags: ['Auth'], summary: 'Validate a reset token', responses: { 200: { description: '{ valid }' } } } },
      '/auth/reset-password': { post: { tags: ['Auth'], summary: 'Set a new password', responses: { 200: { description: 'OK' } } } },

      '/courses': {
        get: { tags: ['Courses'], summary: 'List published courses (filter/sort/paginate)', responses: { 200: { description: 'Courses' } } },
        post: { tags: ['Courses'], summary: 'Create course (instructor → pending)', security: bearer, responses: { 201: { description: 'Course' } } },
      },
      '/courses/{id}': {
        get: { tags: ['Courses'], summary: 'Course detail', responses: { 200: { description: 'Course' }, 404: { description: 'Not found' } } },
        patch: { tags: ['Courses'], summary: 'Update own course', security: bearer, responses: { 200: { description: 'Course' } } },
        delete: { tags: ['Courses'], summary: 'Delete own course', security: bearer, responses: { 200: { description: 'OK' } } },
      },
      '/courses/{id}/reviews': {
        get: { tags: ['Reviews'], summary: 'Course reviews', responses: { 200: { description: 'Reviews' } } },
        post: { tags: ['Reviews'], summary: 'Add a review (enrolled users)', security: bearer, responses: { 201: { description: 'Review' } } },
      },
      '/courses/mine/created': { get: { tags: ['Courses'], summary: 'Courses I created (instructor)', security: bearer, responses: { 200: { description: 'Courses' } } } },

      '/enrollments': {
        get: { tags: ['Enrollments'], summary: 'My enrolled courses', security: bearer, responses: { 200: { description: 'Enrollments' } } },
        post: { tags: ['Enrollments'], summary: 'Enroll in a free course', security: bearer, responses: { 201: { description: 'Enrollment' } } },
      },
      '/progress/{courseId}': {
        get: { tags: ['Progress'], summary: 'My progress for a course', security: bearer, responses: { 200: { description: 'Progress' } } },
        post: { tags: ['Progress'], summary: 'Mark a lecture complete', security: bearer, responses: { 200: { description: 'Progress' } } },
      },

      '/jobs': {
        get: { tags: ['Jobs'], summary: 'List active jobs (filter/sort)', responses: { 200: { description: 'Jobs' } } },
        post: { tags: ['Jobs'], summary: 'Post a job', security: bearer, responses: { 201: { description: 'Job' } } },
      },
      '/jobs/mine': { get: { tags: ['Jobs'], summary: 'Jobs I posted (any status)', security: bearer, responses: { 200: { description: 'Jobs' } } } },
      '/jobs/{id}': {
        get: { tags: ['Jobs'], summary: 'Job detail', responses: { 200: { description: 'Job' } } },
        patch: { tags: ['Jobs'], summary: 'Update own job', security: bearer, responses: { 200: { description: 'Job' } } },
        delete: { tags: ['Jobs'], summary: 'Delete own job', security: bearer, responses: { 200: { description: 'OK' } } },
      },

      '/applications': { post: { tags: ['Applications'], summary: 'Apply to a job (multipart: cv)', security: bearer, responses: { 201: { description: 'Application' } } } },
      '/applications/me': { get: { tags: ['Applications'], summary: 'My applications', security: bearer, responses: { 200: { description: 'Applications' } } } },
      '/applications/posted-by-me': { get: { tags: ['Applications'], summary: 'Applications to my jobs', security: bearer, responses: { 200: { description: 'Applications' } } } },
      '/applications/job/{jobId}': { get: { tags: ['Applications'], summary: 'Applicants for a job (owner/admin)', security: bearer, responses: { 200: { description: 'Applications' } } } },
      '/applications/{id}/status': { patch: { tags: ['Applications'], summary: 'Move applicant through pipeline', security: bearer, responses: { 200: { description: 'Application' } } } },

      '/payments/initialize': { post: { tags: ['Payments'], summary: 'Create order + Paystack init (server-priced)', security: bearer, responses: { 201: { description: 'authorizationUrl + reference' } } } },
      '/payments/verify': { post: { tags: ['Payments'], summary: 'Verify payment → fulfill order + enroll', security: bearer, responses: { 200: { description: 'order + courses' } } } },
      '/payments/webhook/{provider}': { post: { tags: ['Payments'], summary: 'Gateway webhook (raw body, signature-checked)', responses: { 200: { description: 'received' } } } },

      '/videos/upload': { post: { tags: ['Videos'], summary: 'Direct multipart upload (instructor)', security: bearer, responses: { 201: { description: 'VideoAsset' } } } },
      '/videos/create-upload': { post: { tags: ['Videos'], summary: 'Create a direct-to-Bunny TUS upload', security: bearer, responses: { 201: { description: 'uploadUrl + tus' } } } },
      '/videos/webhook/bunny': { post: { tags: ['Videos'], summary: 'Bunny status webhook', responses: { 200: { description: 'received' } } } },
      '/videos/{assetId}': { get: { tags: ['Videos'], summary: 'Poll asset status', security: bearer, responses: { 200: { description: 'VideoAsset' } } } },

      '/certificates': { get: { tags: ['Certificates'], summary: 'My certificates', security: bearer, responses: { 200: { description: 'Certificates' } } } },
      '/certificates/{courseId}': { post: { tags: ['Certificates'], summary: 'Issue certificate for a completed course', security: bearer, responses: { 201: { description: 'Certificate (PDF url)' } } } },

      '/quizzes/{courseId}/{lectureId}': { get: { tags: ['Quizzes'], summary: 'Get a quiz', security: bearer, responses: { 200: { description: 'Quiz' } } } },
      '/quizzes/{courseId}/{lectureId}/submit': { post: { tags: ['Quizzes'], summary: 'Submit quiz answers', security: bearer, responses: { 200: { description: 'Result' } } } },

      '/uploads/image': { post: { tags: ['Uploads'], summary: 'Upload an image → { url }', security: bearer, responses: { 201: { description: '{ url }' } } } },
      '/contact': { post: { tags: ['Contact'], summary: 'Submit a contact lead', responses: { 201: { description: 'OK' } } } },

      '/admin/stats': { get: { tags: ['Admin'], summary: 'Dashboard stats', security: bearer, responses: { 200: { description: 'Stats' } } } },
      '/admin/analytics': { get: { tags: ['Admin'], summary: 'Analytics', security: bearer, responses: { 200: { description: 'Analytics' } } } },
      '/admin/users': { get: { tags: ['Admin'], summary: 'List/search users', security: bearer, responses: { 200: { description: 'Users' } } } },
      '/admin/courses/{id}/approve': { post: { tags: ['Admin'], summary: 'Approve a pending course', security: bearer, responses: { 200: { description: 'Course' } } } },
      '/admin/courses/{id}/reject': { post: { tags: ['Admin'], summary: 'Reject a pending course', security: bearer, responses: { 200: { description: 'Course' } } } },
      '/admin/jobs/{id}/approve': { post: { tags: ['Admin'], summary: 'Approve a pending job', security: bearer, responses: { 200: { description: 'Job' } } } },
      '/admin/jobs/{id}/reject': { post: { tags: ['Admin'], summary: 'Reject a pending job', security: bearer, responses: { 200: { description: 'Job' } } } },
      '/admin/payments': { get: { tags: ['Admin'], summary: 'Payments {summary, transactions}', security: bearer, responses: { 200: { description: 'Payments' } } } },
      '/admin/payments/export': { get: { tags: ['Admin'], summary: 'Export transactions CSV', security: bearer, responses: { 200: { description: 'CSV' } } } },
      '/admin/payments/{id}': { patch: { tags: ['Admin'], summary: 'Update order status (refund/fulfill)', security: bearer, responses: { 200: { description: 'Order' } } } },
    },
  };
}
