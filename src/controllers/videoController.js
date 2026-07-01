import asyncHandler from '../utils/asyncHandler.js';
import ApiError from '../utils/ApiError.js';
import VideoAsset from '../models/VideoAsset.js';
import * as provider from '../services/videoProvider.js';

const baseUrl = (req) => `${req.protocol}://${req.get('host')}`;

function toContract(asset) {
  return {
    assetId: asset.assetId,
    source: asset.source,
    status: asset.status,
    originalName: asset.originalName,
    size: asset.size,
    duration: asset.duration,
    durationLabel: asset.durationLabel,
    thumbnail: asset.thumbnail,
    playbackUrl: asset.playbackUrl,
  };
}

// Pattern A — direct multipart upload.
export const uploadVideo = asyncHandler(async (req, res) => {
  if (!req.file) throw ApiError.badRequest('No video file uploaded');
  const result = await provider.handleDirectUpload({ file: req.file, baseUrl: baseUrl(req) });
  const asset = await VideoAsset.create({ ...result, ownerId: req.userId });
  res.status(201).json(toContract(asset));
});

// Pattern B — create a direct-to-provider upload URL (browser uploads to Bunny
// via TUS for large files; the API key never leaves the server).
export const createUpload = asyncHandler(async (req, res) => {
  const result = await provider.createDirectUpload({
    baseUrl: baseUrl(req),
    title: req.body?.title,
  });
  await VideoAsset.create({
    assetId: result.assetId,
    provider: result.provider,
    providerUploadId: result.providerUploadId || '',
    source: 'upload',
    status: result.status,
    uploadUrl: result.uploadUrl,
    playbackUrl: result.playbackUrl || '',
    thumbnail: result.thumbnail || '',
    ownerId: req.userId,
  });
  res.status(201).json({
    assetId: result.assetId,
    uploadUrl: result.uploadUrl,
    tus: result.tus || null,
    playbackUrl: result.playbackUrl || '',
  });
});

// Bunny Stream webhook → flip processing → ready (no auth; public endpoint).
export const bunnyWebhook = asyncHandler(async (req, res) => {
  const { assetId, status } = provider.parseBunnyWebhook(req.body);
  if (assetId) {
    const asset = await VideoAsset.findOne({
      $or: [{ assetId }, { providerUploadId: assetId }],
    });
    if (asset && status && asset.status !== status) {
      await provider.refreshAssetStatus(asset);
      await asset.save();
    }
  }
  res.json({ received: true });
});

// Poll asset status.
export const getAsset = asyncHandler(async (req, res) => {
  let asset = await VideoAsset.findOne({ assetId: req.params.assetId });
  if (!asset) throw ApiError.notFound('Video asset not found');
  await provider.refreshAssetStatus(asset);
  if (asset.isModified?.()) await asset.save();
  res.json(toContract(asset));
});
