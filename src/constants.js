// Appendix A — single source of truth for enums/constants shared by the API.
export const ROLES = ['participant', 'instructor', 'admin'];

export const COURSE_CATEGORIES = [
  'Corporate Law',
  'Finance & Capital Markets',
  'Mergers & Acquisitions',
  'Corporate Governance',
  'Taxation',
  'Energy & ESG',
  'Dispute Resolution',
];
export const COURSE_LEVELS = ['Beginner', 'Intermediate', 'Advanced', 'All Levels'];
export const COURSE_LANGUAGES = ['English', 'French', 'Yoruba', 'Hausa', 'Igbo'];
export const LECTURE_TYPES = ['video', 'quiz', 'assignment'];
export const COURSE_SORTS = ['popular', 'rating', 'newest', 'price-low', 'price-high'];

export const JOB_CATEGORIES = [
  'Legal',
  'Finance',
  'Compliance & Risk',
  'Corporate Governance',
  'Tax',
  'Energy & Resources',
  'Consulting',
];
export const JOB_TYPES = ['Full-time', 'Part-time', 'Internship', 'Contract', 'Freelance'];
export const JOB_LOCATION_TYPES = ['Remote', 'On-site', 'Hybrid'];
export const JOB_LEVELS = ['Entry', 'Mid-level', 'Senior', 'Manager'];
export const JOB_SORTS = ['newest', 'popular', 'salary-high'];
export const SALARY_PERIODS = ['monthly', 'yearly', 'hourly'];

export const APPLICATION_STATUS = [
  'pending',
  'reviewed',
  'shortlisted',
  'rejected',
  'accepted',
];
export const APPLICATION_EXPERIENCE = [
  'Less than 1 year',
  '1-2 years',
  '3-5 years',
  '5-10 years',
  '10+ years',
];

export const PAYMENT_METHODS = ['card', 'paypal', 'bank'];
export const ORDER_STATUS = ['pending', 'paid', 'failed', 'refunded'];
export const CHECKOUT_COUNTRIES = [
  'Nigeria',
  'Ghana',
  'Kenya',
  'South Africa',
  'United States',
  'United Kingdom',
];

export const QUIZ_PASS_MARK = 70;

export const USER_STATUS = ['active', 'suspended'];

// Course moderation: instructor submits → 'pending'; admin approves → 'published'
// or rejects → 'rejected'. 'draft' is the "Save Draft" state. Only 'published'
// courses appear in public listings.
export const COURSE_STATUS = ['draft', 'pending', 'published', 'rejected'];

// Job moderation: employer submits → 'pending' (isActive:false); admin approves
// → 'approved' (isActive:true) or rejects → 'rejected'.
export const JOB_STATUS = ['pending', 'approved', 'rejected'];
