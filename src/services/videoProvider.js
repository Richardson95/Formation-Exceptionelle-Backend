import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { Readable } from 'stream';
import env from '../config/env.js';
import { durationLabel } from '../utils/relativeTime.js';

/**
 * Video provider abstraction. Returns the VideoAsset contract (§8).
 *
 * - `mock` (default): direct uploads are served from local /uploads and marked
 *   ready immediately; Pattern B returns a fake upload URL.
 * - `bunny`: Bunny Stream. Activates only when VIDEO_PROVIDER=bunny and the
 *   library id + api key are present (env.bunnyEnabled). Videos transcode to
 *   adaptive HLS; the frontend polls GET /api/videos/:assetId until 'ready'.
 *
 * Bunny status codes: 0 Created · 1 Uploaded · 2 Processing · 3 Transcoding
 *                     · 4 Finished · 5 Error · 6 UploadFailed
 */

const BUNNY_API = 'https://video.bunnycdn.com';
const newAssetId = () => `va_${crypto.randomBytes(10).toString('hex')}`;

function buildPublicUrl(baseUrl, subdir, filename) {
  return `${baseUrl}/uploads/${subdir}/${filename}`;
}

// ── Bunny helpers ────────────────────────────────────────────────────────────
async function bunny(pathname, { method = 'GET', body, raw } = {}) {
  const res = await fetch(`${BUNNY_API}/library/${env.BUNNY_STREAM_LIBRARY_ID}${pathname}`, {
    method,
    headers: {
      AccessKey: env.BUNNY_STREAM_API_KEY,
      accept: 'application/json',
      ...(raw ? {} : { 'content-type': 'application/json' }),
    },
    body: raw || (body ? JSON.stringify(body) : undefined),
    ...(raw ? { duplex: 'half' } : {}),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Bunny request failed (${res.status}): ${text}`);
  }
  return res.status === 204 ? {} : res.json();
}

function bunnyPlaybackUrl(guid) {
  return env.BUNNY_STREAM_CDN ? `https://${env.BUNNY_STREAM_CDN}/${guid}/playlist.m3u8` : '';
}
function bunnyThumbnail(guid) {
  return env.BUNNY_STREAM_CDN ? `https://${env.BUNNY_STREAM_CDN}/${guid}/thumbnail.jpg` : '';
}
function mapBunnyStatus(code) {
  return code === 4 ? 'ready' : 'processing';
}

async function createBunnyVideo(title) {
  const video = await bunny('/videos', { method: 'POST', body: { title: title || 'Untitled lecture' } });
  return video.guid;
}

// ── Direct multipart upload (Pattern A) ─────────────────────────────────────
export async function handleDirectUpload({ file, baseUrl }) {
  if (env.bunnyEnabled) {
    const guid = await createBunnyVideo(file.originalname);
    // Stream the file straight to Bunny (no full-buffer in memory).
    const stream = Readable.toWeb(fs.createReadStream(file.path));
    await bunny(`/videos/${guid}`, { method: 'PUT', raw: stream });
    await fs.promises.unlink(file.path).catch(() => {});
    return {
      assetId: guid,
      provider: 'bunny',
      providerUploadId: guid,
      source: 'upload',
      status: 'processing', // Bunny transcodes async; frontend polls until ready
      originalName: file.originalname,
      size: file.size,
      duration: 0,
      durationLabel: '0:00',
      thumbnail: bunnyThumbnail(guid),
      playbackUrl: bunnyPlaybackUrl(guid),
    };
  }

  // Mock: serve from local /uploads, ready immediately.
  const filename = path.basename(file.path);
  return {
    assetId: newAssetId(),
    provider: 'mock',
    source: 'upload',
    status: 'ready',
    originalName: file.originalname,
    size: file.size,
    duration: 0,
    durationLabel: durationLabel(0),
    thumbnail: '',
    playbackUrl: buildPublicUrl(baseUrl, 'videos', filename),
  };
}

// ── Presigned / direct-to-provider (Pattern B) ──────────────────────────────
// For large files the browser uploads straight to Bunny via TUS, keeping the
// API key server-side. Returns the data tus-js-client needs.
export async function createDirectUpload({ baseUrl, title } = {}) {
  if (env.bunnyEnabled) {
    const guid = await createBunnyVideo(title);
    const expiration = Date.now() + 60 * 60 * 1000; // 1 hour
    const signature = crypto
      .createHash('sha256')
      .update(`${env.BUNNY_STREAM_LIBRARY_ID}${env.BUNNY_STREAM_API_KEY}${expiration}${guid}`)
      .digest('hex');
    return {
      assetId: guid,
      provider: 'bunny',
      providerUploadId: guid,
      status: 'processing',
      uploadUrl: `${BUNNY_API}/tusupload`,
      tus: {
        endpoint: `${BUNNY_API}/tusupload`,
        headers: {
          AuthorizationSignature: signature,
          AuthorizationExpire: String(expiration),
          LibraryId: String(env.BUNNY_STREAM_LIBRARY_ID),
          VideoId: guid,
        },
      },
      playbackUrl: bunnyPlaybackUrl(guid),
      thumbnail: bunnyThumbnail(guid),
    };
  }

  // Mock: return a fake upload URL.
  const assetId = newAssetId();
  return {
    assetId,
    provider: 'mock',
    uploadUrl: `${baseUrl}/api/videos/${assetId}/mock-put`,
    status: 'processing',
  };
}

/**
 * Resolve the latest status from the provider for a stored asset.
 */
export async function refreshAssetStatus(asset) {
  if (asset.provider === 'bunny' && asset.status !== 'ready') {
    try {
      const guid = asset.providerUploadId || asset.assetId;
      const v = await bunny(`/videos/${guid}`);
      asset.status = mapBunnyStatus(v.status);
      if (typeof v.length === 'number' && v.length > 0) {
        asset.duration = v.length;
        asset.durationLabel = durationLabel(v.length);
      }
      asset.playbackUrl = bunnyPlaybackUrl(guid);
      asset.thumbnail = bunnyThumbnail(guid);
    } catch {
      // leave as-is; caller will retry on next poll
    }
    return asset;
  }

  if (asset.provider === 'mock' && asset.status === 'processing') {
    asset.status = 'ready';
    if (!asset.playbackUrl) asset.playbackUrl = asset.uploadUrl || '';
  }
  return asset;
}

/** Map a Bunny webhook payload to { assetId, status }. */
export function parseBunnyWebhook(event) {
  // { VideoLibraryId, VideoGuid, Status }
  return {
    assetId: event?.VideoGuid,
    status: mapBunnyStatus(event?.Status),
  };
}
