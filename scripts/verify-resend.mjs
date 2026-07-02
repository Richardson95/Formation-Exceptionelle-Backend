// Verifies the live Resend integration end-to-end.
// Usage:  node scripts/verify-resend.mjs you@example.com
// Reads RESEND_API_KEY / MAIL_FROM / MAIL_TRANSPORT from .env.
import '../src/config/env.js';
import env from '../src/config/env.js';
import { sendMail, brandedEmail, ctaButton } from '../src/services/mailer.js';

const to = process.argv[2];

if (!to) {
  console.error('Usage: node scripts/verify-resend.mjs <recipient-email>');
  process.exit(1);
}

console.log('MAIL_TRANSPORT :', env.MAIL_TRANSPORT);
console.log('resendEnabled  :', env.resendEnabled);
console.log('MAIL_FROM      :', env.MAIL_FROM);
console.log('RESEND_API_KEY :', env.RESEND_API_KEY ? `set (${env.RESEND_API_KEY.slice(0, 6)}…)` : 'MISSING');

if (!env.resendEnabled) {
  console.error(
    '\n✗ Resend is not active. Set MAIL_TRANSPORT=resend and RESEND_API_KEY=re_... in .env',
  );
  process.exit(1);
}

try {
  const result = await sendMail({
    to,
    subject: 'Resend integration test — Formation Exceptionelle',
    html: brandedEmail({
      title: 'Resend is live ✅',
      body: `<p>This is a test email confirming the Resend integration is working end-to-end.</p>
             ${ctaButton('Visit the platform', env.CLIENT_ORIGIN)}`,
    }),
    text: 'Resend integration test — if you can read this, email delivery works.',
  });
  console.log('\n✓ Sent:', JSON.stringify(result));
  console.log(`Check the inbox for ${to} (and the spam folder).`);
} catch (err) {
  console.error('\n✗ Send failed:', err.message);
  process.exit(1);
}
