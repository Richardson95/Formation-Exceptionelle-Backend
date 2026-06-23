import crypto from 'crypto';
import path from 'path';
import env from '../config/env.js';
import { durationLabel } from '../utils/relativeTime.js';

/**
 * Video provider abstraction. Returns the VideoAsset contract (§8).
 *
 * - `mock` (default): no external service. Direct uploads are served from local
 *   /uploads and marked ready immediately. Pattern B returns a fake upload URL.
 * - `mux` / `cloudflare-stream` / `s3`: TODO hooks — wire the real SDK calls.
 *   The shapes returned here already match what the frontend expects, so only the
 *   provider internals need filling in.
 */

const newAssetId = () => `va_${crypto.randomBytes(10).toString('hex')}`;

function buildPublicUrl(baseUrl, subdir, filename) {
  return `${baseUrl}/uploads/${subdir}/${filename}`;
}

// ── Direct multipart upload (Pattern A) ─────────────────────────────────────
export async function handleDirectUpload({ file, baseUrl }) {
  const provider = env.VIDEO_PROVIDER;

  if (provider === 'mock') {
    const filename = path.basename(file.path);
    const seconds = 0; // unknown without probing; provider would return real duration
    return {
      assetId: newAssetId(),
      provider: 'mock',
      source: 'upload',
      status: 'ready',
      originalName: file.originalname,
      size: file.size,
      duration: seconds,
      durationLabel: durationLabel(seconds),
      thumbnail: '',
      playbackUrl: buildPublicUrl(baseUrl, 'videos', filename),
    };
  }

  // TODO: provider-specific direct upload (e.g. push file buffer to Mux/S3).
  // For now behave like mock so the endpoint never hard-fails in dev.
  const filename = path.basename(file.path);
  return {
    assetId: newAssetId(),
    provider,
    source: 'upload',
    status: 'ready',
    originalName: file.originalname,
    size: file.size,
    duration: 0,
    durationLabel: '0:00',
    thumbnail: '',
    playbackUrl: buildPublicUrl(baseUrl, 'videos', filename),
  };
}

// ── Presigned / direct-to-provider (Pattern B) ──────────────────────────────
export async function createDirectUpload({ baseUrl }) {
  const provider = env.VIDEO_PROVIDER;
  const assetId = newAssetId();

  if (provider === 'mux' && env.MUX_TOKEN_ID && env.MUX_TOKEN_SECRET) {
    // TODO: const upload = await mux.video.uploads.create({ new_asset_settings: {...} })
    //       return { uploadUrl: upload.url, assetId: upload.id }
  }

  // Mock: return a fake upload URL; the asset is created in 'processing' and can
  // be flipped to ready via the webhook/poll simulation.
  return {
    assetId,
    provider,
    uploadUrl: `${baseUrl}/api/videos/${assetId}/mock-put`,
    status: 'processing',
  };
}

/**
 * Resolve the latest status from the provider for a stored asset.
 * In mock mode we just echo what we have. Real providers would query their API
 * or rely on webhooks to have already updated the record.
 */
export async function refreshAssetStatus(asset) {
  if (asset.provider === 'mock' && asset.status === 'processing') {
    // Simulate processing finishing.
    asset.status = 'ready';
    if (!asset.playbackUrl) asset.playbackUrl = asset.uploadUrl || '';
  }
  return asset;
}
