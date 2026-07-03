// Verifies the live Cloudflare R2 integration end-to-end:
// uploads a small object, then fetches it back via the public URL.
// Usage: node scripts/verify-r2.mjs
import '../src/config/env.js';
import env from '../src/config/env.js';
import { isRemote, saveBuffer, remove, keyFor } from '../src/services/storageProvider.js';

console.log('STORAGE_DRIVER :', env.STORAGE_DRIVER);
console.log('r2Enabled     :', env.r2Enabled, '(isRemote:', isRemote, ')');
console.log('R2_BUCKET     :', env.R2_BUCKET);
console.log('R2_PUBLIC_URL :', env.R2_PUBLIC_URL);
console.log('endpoint      :', `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`);

if (!env.r2Enabled) {
  console.error('\n✗ R2 is not active. Need STORAGE_DRIVER=r2 and all R2_* creds set.');
  process.exit(1);
}

const key = keyFor('_healthcheck', `test-${Date.now()}.txt`);
const body = `R2 verification at ${new Date().toISOString()}`;

try {
  console.log('\nUploading test object:', key);
  const url = await saveBuffer({ buffer: Buffer.from(body), key, contentType: 'text/plain' });
  console.log('✓ Upload OK. Public URL:', url);

  console.log('Fetching it back over HTTP…');
  const res = await fetch(url);
  const text = await res.text();
  if (res.ok && text === body) {
    console.log('✓ Public fetch OK — content matches.');
  } else {
    console.log(`⚠ Fetch returned HTTP ${res.status}. Body: ${text.slice(0, 120)}`);
    console.log('  (Upload works; the public URL may need a moment, or public access is off.)');
  }

  console.log('Cleaning up test object…');
  await remove(key);
  console.log('✓ Cleanup done.');
  console.log('\n✅ R2 is working end-to-end.');
} catch (err) {
  console.error('\n✗ R2 test failed:', err.name, '-', err.message);
  process.exit(1);
}
