import nodemailer from 'nodemailer';
import env from '../config/env.js';

const BRAND = {
  purple: '#4c1d95',
  purpleLight: '#7c3aed',
  gold: '#f59e0b',
};

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;
  if (env.MAIL_TRANSPORT === 'smtp' && env.SMTP_HOST) {
    transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_PORT === 465,
      auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
    });
  }
  return transporter;
}

/** Wrap inner HTML in a branded shell. */
export function brandedEmail({ title, body }) {
  return `<!doctype html><html><body style="margin:0;background:#f4f4f7;font-family:Segoe UI,Arial,sans-serif;color:#1f2937;">
  <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px;">
    <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;">
      <tr><td style="background:linear-gradient(135deg,${BRAND.purple},${BRAND.purpleLight});padding:24px 32px;">
        <span style="color:#fff;font-size:20px;font-weight:700;">Formation Exceptionelle</span>
        <span style="color:${BRAND.gold};font-size:12px;display:block;margin-top:4px;">Your Partner In Career Development</span>
      </td></tr>
      <tr><td style="padding:32px;">
        <h1 style="font-size:20px;margin:0 0 16px;color:${BRAND.purple};">${title}</h1>
        ${body}
      </td></tr>
      <tr><td style="padding:20px 32px;background:#f9fafb;color:#9ca3af;font-size:12px;">
        &copy; ${new Date().getFullYear()} Formation Exceptionelle. All rights reserved.
      </td></tr>
    </table>
  </td></tr></table></body></html>`;
}

export function ctaButton(label, url) {
  return `<a href="${url}" style="display:inline-block;background:${BRAND.gold};color:#1f2937;font-weight:700;text-decoration:none;padding:12px 24px;border-radius:8px;margin:12px 0;">${label}</a>`;
}

/**
 * Send an email. Falls back to console logging when no transport is configured
 * (dev "demo mode") so flows remain testable without an SMTP server.
 */
export async function sendMail({ to, subject, html, text }) {
  const t = getTransporter();
  if (!t) {
    // eslint-disable-next-line no-console
    console.log(`\n[mailer:console] To: ${to}\n[mailer:console] Subject: ${subject}\n${text || '(html email)'}\n`);
    return { delivered: false, transport: 'console' };
  }
  await t.sendMail({ from: env.MAIL_FROM, to, subject, html, text });
  return { delivered: true, transport: env.MAIL_TRANSPORT };
}

// ── Convenience templated senders ───────────────────────────────────────────

export function sendWelcomeEmail(user) {
  return sendMail({
    to: user.email,
    subject: 'Welcome to Formation Exceptionelle!',
    html: brandedEmail({
      title: `Welcome, ${user.firstName}!`,
      body: `<p>Your account is ready. Explore 200+ courses, find jobs, and grow your career.</p>
             ${ctaButton('Browse Courses', `${env.CLIENT_ORIGIN}/lms`)}`,
    }),
    text: `Welcome to Formation Exceptionelle, ${user.firstName}!`,
  });
}

export function sendPasswordResetEmail(user, resetUrl) {
  return sendMail({
    to: user.email,
    subject: 'Reset your password',
    html: brandedEmail({
      title: 'Password reset request',
      body: `<p>We received a request to reset your password. This link expires in 30 minutes.</p>
             ${ctaButton('Reset Password', resetUrl)}
             <p style="color:#6b7280;font-size:13px;">If you didn't request this, you can safely ignore this email.</p>`,
    }),
    text: `Reset your password: ${resetUrl}`,
  });
}

export function sendEnrollmentEmail(user, courses) {
  const list = courses.map((c) => `<li>${c.title}</li>`).join('');
  return sendMail({
    to: user.email,
    subject: 'Your enrollment is confirmed',
    html: brandedEmail({
      title: 'Payment received — you are enrolled!',
      body: `<p>Thanks for your purchase. You now have access to:</p><ul>${list}</ul>
             ${ctaButton('Start Learning', `${env.CLIENT_ORIGIN}/lms`)}`,
    }),
    text: `You are enrolled in: ${courses.map((c) => c.title).join(', ')}`,
  });
}

export function sendApplicationEmail(user, job) {
  return sendMail({
    to: user.email,
    subject: `Application received — ${job.title}`,
    html: brandedEmail({
      title: 'Application submitted',
      body: `<p>Your application for <strong>${job.title}</strong> at ${job.company} has been received. The hiring team will review it within 5-7 business days.</p>`,
    }),
    text: `Application received for ${job.title} at ${job.company}.`,
  });
}

// Sent to the candidate when the employer/admin moves their application along.
export function sendApplicationStatusEmail(application, job) {
  const labels = {
    pending: 'is under review',
    reviewed: 'has been reviewed',
    shortlisted: 'has been shortlisted',
    accepted: 'has been accepted — congratulations!',
    rejected: 'was not selected on this occasion',
  };
  const phrase = labels[application.status] || `is now "${application.status}"`;
  return sendMail({
    to: application.email,
    subject: `Update on your application — ${job.title}`,
    html: brandedEmail({
      title: 'Application update',
      body: `<p>Hi ${application.fullName},</p>
             <p>Your application for <strong>${job.title}</strong> at ${job.company} ${phrase}.</p>`,
    }),
    text: `Your application for ${job.title} at ${job.company} ${phrase}.`,
  });
}

export function sendCertificateEmail(user, certificate) {
  return sendMail({
    to: user.email,
    subject: `Your certificate for ${certificate.courseTitle}`,
    html: brandedEmail({
      title: 'Congratulations!',
      body: `<p>You've earned a certificate for <strong>${certificate.courseTitle}</strong>.</p>
             ${certificate.pdfUrl ? ctaButton('Download Certificate', certificate.pdfUrl) : ''}`,
    }),
    text: `Your certificate for ${certificate.courseTitle} (ID: ${certificate.code}).`,
  });
}

export function sendContactEmail(lead) {
  return sendMail({
    to: env.SEED_ADMIN_EMAIL,
    subject: `New contact form submission from ${lead.name}`,
    html: brandedEmail({
      title: 'New contact / lead',
      body: `<p><strong>Name:</strong> ${lead.name}</p>
             <p><strong>Email:</strong> ${lead.email}</p>
             ${lead.phone ? `<p><strong>Phone:</strong> ${lead.phone}</p>` : ''}
             ${lead.subject ? `<p><strong>Subject:</strong> ${lead.subject}</p>` : ''}
             <p><strong>Message:</strong><br/>${lead.message}</p>`,
    }),
    text: `Contact from ${lead.name} <${lead.email}>: ${lead.message}`,
  });
}
