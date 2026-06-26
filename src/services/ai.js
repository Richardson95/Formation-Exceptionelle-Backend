import Anthropic from '@anthropic-ai/sdk';
import env from '../config/env.js';

const SYSTEM_PROMPT = `You are the AI Career Assistant for Formation Exceptionelle, a professional corporate, legal and finance training & career platform for the African (primarily Nigerian) market. The platform offers:
- Expert-led programmes (Udemy-style LMS) in corporate law, finance & capital markets, mergers & acquisitions, corporate governance, taxation, energy & ESG, and dispute resolution: browse, buy, enroll, watch videos, take quizzes, earn certificates.
- A Jobs & Internships board for legal, finance, compliance, governance, tax and consulting roles: search and apply with a CV + cover letter, or post jobs as an employer.
- A faculty/instructor program: professionals can "Become an Instructor" and create/sell courses.

Be concise, professional, and practical. Help users with course selection, career advice, job searching, and using the platform. When relevant, suggest in-app navigation as quick actions using these paths only: /lms (courses), /jobs (jobs), /become-instructor (teach). All amounts on the platform are in Nigerian Naira — NGN (₦): course prices, salaries, payments and revenue.`;

let client = null;
function getClient() {
  if (!env.ANTHROPIC_API_KEY) return null;
  if (!client) client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  return client;
}

// ── Canned fallback (mirrors the original frontend keyword matching) ─────────
function cannedReply(message) {
  const text = (message || '').toLowerCase();
  if (/course|learn|study|class|programme|program/.test(text)) {
    return {
      reply:
        'We offer expert-led programmes in Corporate Law, Finance & Capital Markets, Mergers & Acquisitions, Corporate Governance, Taxation, Energy & ESG and Dispute Resolution. Browse the catalog to find one that fits your goals.',
      quickActions: [{ label: 'Browse Courses', path: '/lms' }],
    };
  }
  if (/job|work|career|intern|hire|employ/.test(text)) {
    return {
      reply:
        'Looking for your next role? Our board has 500+ jobs and internships. You can filter by category, type and location, then apply with your CV and a cover letter.',
      quickActions: [{ label: 'Find Jobs', path: '/jobs' }],
    };
  }
  if (/instructor|teach|sell|create course/.test(text)) {
    return {
      reply:
        'You can share your expertise and earn by becoming an instructor. Apply through the Become an Instructor flow to start creating and selling courses.',
      quickActions: [{ label: 'Become an Instructor', path: '/become-instructor' }],
    };
  }
  return {
    reply:
      "I'm your career assistant. I can help you find courses, search for jobs, or become an instructor. What would you like to do?",
    quickActions: [
      { label: 'Browse Courses', path: '/lms' },
      { label: 'Find Jobs', path: '/jobs' },
    ],
  };
}

/**
 * Generate an assistant reply. Uses Claude when ANTHROPIC_API_KEY is set,
 * otherwise falls back to the canned keyword responses.
 */
export async function generateReply({ messages }) {
  const c = getClient();
  const lastUser = [...(messages || [])].reverse().find((m) => m.role === 'user');

  if (!c) return cannedReply(lastUser?.content);

  try {
    const response = await c.messages.create({
      model: env.AI_MODEL,
      max_tokens: 600,
      system: SYSTEM_PROMPT,
      messages: (messages || []).map((m) => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: String(m.content || ''),
      })),
    });
    const reply = response.content
      .filter((b) => b.type === 'text')
      .map((b) => b.text)
      .join('\n')
      .trim();

    // Lightweight quick-action suggestion based on the reply content.
    const quickActions = [];
    if (/\/lms|course/i.test(reply)) quickActions.push({ label: 'Browse Courses', path: '/lms' });
    if (/\/jobs|job/i.test(reply)) quickActions.push({ label: 'Find Jobs', path: '/jobs' });
    if (/instructor/i.test(reply)) quickActions.push({ label: 'Become an Instructor', path: '/become-instructor' });

    return { reply: reply || cannedReply(lastUser?.content).reply, quickActions };
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[ai] falling back to canned reply:', err.message);
    return cannedReply(lastUser?.content);
  }
}
