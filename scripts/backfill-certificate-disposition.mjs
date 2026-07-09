// Backfill `Content-Disposition: attachment` onto certificate PDFs issued before
// that header was set, so they download under their certificate code instead of
// opening in a browser tab.
//
// Re-renders each PDF and overwrites the SAME storage key, so `pdfUrl` never
// changes and no link anywhere goes stale. It deliberately does not touch the
// Certificate documents or the mailer: clearing `pdfUrl` to force regeneration
// through /certificates/generate would re-send the certificate email to every
// student who already earned one.
//
//   node scripts/backfill-certificate-disposition.mjs           # dry run
//   node scripts/backfill-certificate-disposition.mjs --apply   # write
import env from '../src/config/env.js';
import { connectDB, disconnectDB } from '../src/config/db.js';
import Certificate from '../src/models/Certificate.js';
import { renderCertificatePdf } from '../src/services/certificatePdf.js';
import { isRemote } from '../src/services/storageProvider.js';

const APPLY = process.argv.includes('--apply');

/** Does the stored object already download as an attachment? */
async function dispositionOf(url) {
  try {
    const res = await fetch(url, { method: 'HEAD' });
    if (!res.ok) return { status: res.status, disposition: null };
    return { status: res.status, disposition: res.headers.get('content-disposition') };
  } catch (err) {
    return { status: 0, disposition: null, error: err.message };
  }
}

const isAttachment = (d) => !!d && d.toLowerCase().startsWith('attachment');

console.log(`mode        : ${APPLY ? 'APPLY (will overwrite objects)' : 'DRY RUN (no writes)'}`);
console.log(`storage     : ${isRemote ? `R2 bucket ${env.R2_BUCKET}` : `local disk ${env.UPLOAD_DIR}`}`);

if (!isRemote) {
  console.error('\nRefusing to run: storage is local, where Content-Disposition is set by the');
  console.error('static file server, not by the stored object. Nothing to backfill.');
  process.exit(1);
}

await connectDB(env.MONGODB_URI);

const certs = await Certificate.find({ pdfUrl: { $ne: null } }).sort({ issuedAt: 1 });
console.log(`certificates: ${certs.length} with a pdfUrl\n`);

let fixed = 0;
let already = 0;
let failed = 0;

for (const cert of certs) {
  const before = await dispositionOf(cert.pdfUrl);

  if (before.status !== 200) {
    console.log(`  ✗ ${cert.code.padEnd(22)} unreachable (HTTP ${before.status}) ${before.error || ''}`);
    failed++;
    continue;
  }
  if (isAttachment(before.disposition)) {
    console.log(`  – ${cert.code.padEnd(22)} already an attachment, skipped`);
    already++;
    continue;
  }
  if (!APPLY) {
    console.log(`  → ${cert.code.padEnd(22)} would re-upload (currently: ${before.disposition || 'no disposition'})`);
    fixed++;
    continue;
  }

  try {
    // Same code => same filename => same storage key => same public URL.
    const url = await renderCertificatePdf({ certificate: cert });
    const after = await dispositionOf(url);

    if (url !== cert.pdfUrl) {
      console.log(`  ✗ ${cert.code.padEnd(22)} URL changed (${cert.pdfUrl} -> ${url}); leaving document untouched`);
      failed++;
    } else if (isAttachment(after.disposition)) {
      console.log(`  ✓ ${cert.code.padEnd(22)} now downloads as ${cert.code}.pdf`);
      fixed++;
    } else {
      console.log(`  ✗ ${cert.code.padEnd(22)} re-uploaded but header missing (${after.disposition || 'none'})`);
      failed++;
    }
  } catch (err) {
    console.log(`  ✗ ${cert.code.padEnd(22)} ${err.message}`);
    failed++;
  }
}

console.log(
  `\n${APPLY ? 'fixed' : 'would fix'}: ${fixed}   already correct: ${already}   failed: ${failed}`
);
if (!APPLY && fixed > 0) console.log('\nRe-run with --apply to write.');

await disconnectDB();
process.exit(failed ? 1 : 0);
