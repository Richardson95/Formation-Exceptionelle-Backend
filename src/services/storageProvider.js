import fs from 'fs';
import path from 'path';
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import env from '../config/env.js';

/**
 * File storage abstraction (avatars, logos, thumbnails, CVs, certificates).
 *
 * - `local` (default): files live under /uploads and are served by express.static.
 *   Durable on a persistent disk, but ephemeral on free PaaS dynos.
 * - `r2`: Cloudflare R2 (S3-compatible). Durable + zero egress. Activates only
 *   when STORAGE_DRIVER=r2 and all R2_* credentials are present (env.r2Enabled).
 *
 * Public API:
 *   isRemote                       -> boolean
 *   keyFor(subdir, filename)       -> 'subdir/filename'
 *   saveLocalFile({ filePath, key, contentType, cleanup }) -> public URL
 *   saveBuffer({ buffer, key, contentType })               -> public URL
 *   localUrl(baseUrl, subdir, filename)                    -> dev fallback URL
 *   remove(key)                    -> best-effort delete (R2 only)
 */

export const isRemote = env.r2Enabled;

let client = null;
function getClient() {
  if (client) return client;
  client = new S3Client({
    region: 'auto',
    endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: env.R2_ACCESS_KEY_ID,
      secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    },
  });
  return client;
}

export function keyFor(subdir, filename) {
  return `${subdir}/${filename}`.replace(/^\/+/, '');
}

/** The public URL for an object key once stored in R2. */
function remoteUrl(key) {
  return `${env.R2_PUBLIC_URL.replace(/\/+$/, '')}/${key}`;
}

/** Dev/local public URL served by express.static('/uploads'). */
export function localUrl(baseUrl, subdir, filename) {
  return `${baseUrl}/uploads/${subdir}/${filename}`;
}

/**
 * Upload a file that multer already wrote to local disk. In remote mode it is
 * pushed to R2 and (by default) the local temp copy is removed; in local mode
 * it simply stays on disk and we return its static URL.
 */
export async function saveLocalFile({ filePath, key, contentType, baseUrl, cleanup = true }) {
  if (!isRemote) {
    // Local mode: file is already in place under uploadRoot/<subdir>/<filename>.
    const subdir = path.dirname(key);
    const filename = path.basename(key);
    return localUrl(baseUrl, subdir, filename);
  }
  const body = await fs.promises.readFile(filePath);
  await getClient().send(
    new PutObjectCommand({
      Bucket: env.R2_BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
    })
  );
  if (cleanup) await fs.promises.unlink(filePath).catch(() => {});
  return remoteUrl(key);
}

/** Upload an in-memory buffer (e.g. a generated certificate PDF). */
export async function saveBuffer({ buffer, key, contentType, baseUrl }) {
  if (!isRemote) {
    const abs = path.join(path.resolve(process.cwd(), env.UPLOAD_DIR), key);
    await fs.promises.mkdir(path.dirname(abs), { recursive: true });
    await fs.promises.writeFile(abs, buffer);
    const subdir = path.dirname(key);
    const filename = path.basename(key);
    return localUrl(baseUrl, subdir, filename);
  }
  await getClient().send(
    new PutObjectCommand({
      Bucket: env.R2_BUCKET,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    })
  );
  return remoteUrl(key);
}

/** Best-effort delete (used on refund/cleanup). No-op in local mode. */
export async function remove(key) {
  if (!isRemote) return;
  await getClient()
    .send(new DeleteObjectCommand({ Bucket: env.R2_BUCKET, Key: key }))
    .catch(() => {});
}
