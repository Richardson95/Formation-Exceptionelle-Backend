import path from 'path';
import asyncHandler from '../utils/asyncHandler.js';
import ApiError from '../utils/ApiError.js';
import * as storage from '../services/storageProvider.js';

const baseUrl = (req) => `${req.protocol}://${req.get('host')}`;

// POST /api/uploads/image → { url }  (course thumbnails, avatars, logos)
// Stored on R2 when configured, otherwise on local disk.
export const uploadImage = asyncHandler(async (req, res) => {
  if (!req.file) throw ApiError.badRequest('No image uploaded');
  const filename = path.basename(req.file.path);
  const url = await storage.saveLocalFile({
    filePath: req.file.path,
    key: storage.keyFor('images', filename),
    contentType: req.file.mimetype,
    baseUrl: baseUrl(req),
  });
  res.status(201).json({ url });
});
