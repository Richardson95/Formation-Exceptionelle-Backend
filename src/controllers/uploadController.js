import path from 'path';
import asyncHandler from '../utils/asyncHandler.js';
import ApiError from '../utils/ApiError.js';

const fileUrl = (req, file, subdir) =>
  `${req.protocol}://${req.get('host')}/uploads/${subdir}/${path.basename(file.path)}`;

// POST /api/uploads/image → { url }  (course thumbnails, avatars, logos)
export const uploadImage = asyncHandler(async (req, res) => {
  if (!req.file) throw ApiError.badRequest('No image uploaded');
  res.status(201).json({ url: fileUrl(req, req.file, 'images') });
});
