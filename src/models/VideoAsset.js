import mongoose from 'mongoose';
import { baseSchemaOptions } from './_shared.js';

/**
 * Tracks an uploaded/processing video so the frontend can poll
 * GET /api/videos/:assetId until status === 'ready'.
 * `assetId` is the public id the frontend uses (may differ from db _id).
 */
const videoAssetSchema = new mongoose.Schema(
  {
    assetId: { type: String, required: true, unique: true, index: true },
    provider: { type: String, default: 'mock' },
    source: { type: String, enum: ['upload', 'url'], default: 'upload' },
    status: { type: String, enum: ['processing', 'ready'], default: 'processing' },
    originalName: { type: String, default: '' },
    size: { type: Number, default: 0 },
    duration: { type: Number, default: 0 },
    durationLabel: { type: String, default: '0:00' },
    thumbnail: { type: String, default: '' },
    playbackUrl: { type: String, default: '' },
    uploadUrl: { type: String, default: '' }, // Pattern B (direct-to-provider)
    ownerId: { type: String, index: true },
    providerUploadId: { type: String, default: '' },
  },
  baseSchemaOptions()
);

const VideoAsset = mongoose.model('VideoAsset', videoAssetSchema);
export default VideoAsset;
