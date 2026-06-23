import fs from 'fs';
import path from 'path';
import multer from 'multer';
import env from '../config/env.js';
import ApiError from '../utils/ApiError.js';

const uploadRoot = path.resolve(process.cwd(), env.UPLOAD_DIR);

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function diskStorage(subdir) {
  return multer.diskStorage({
    destination(req, file, cb) {
      cb(null, ensureDir(path.join(uploadRoot, subdir)));
    },
    filename(req, file, cb) {
      const ext = path.extname(file.originalname);
      const base = path
        .basename(file.originalname, ext)
        .replace(/[^a-z0-9_-]+/gi, '_')
        .slice(0, 40);
      cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}-${base}${ext}`);
    },
  });
}

function fileFilter(allowed, label) {
  return (req, file, cb) => {
    if (allowed.test(file.mimetype)) return cb(null, true);
    cb(ApiError.badRequest(`Invalid file type for ${label}`, 'invalid_file_type'));
  };
}

export const videoUpload = multer({
  storage: diskStorage('videos'),
  limits: { fileSize: env.MAX_VIDEO_MB * 1024 * 1024 },
  fileFilter: fileFilter(/^video\//, 'video'),
});

export const imageUpload = multer({
  storage: diskStorage('images'),
  limits: { fileSize: env.MAX_IMAGE_MB * 1024 * 1024 },
  fileFilter: fileFilter(/^image\//, 'image'),
});

export const cvUpload = multer({
  storage: diskStorage('cvs'),
  limits: { fileSize: env.MAX_CV_MB * 1024 * 1024 },
  fileFilter: fileFilter(
    /(pdf|msword|officedocument\.wordprocessingml\.document)$/i,
    'CV (PDF/DOC/DOCX)'
  ),
});

export { uploadRoot };
