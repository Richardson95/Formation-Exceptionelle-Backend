import { Router } from 'express';
import * as ctrl from '../controllers/uploadController.js';
import { authRequired } from '../middleware/auth.js';
import { imageUpload } from '../middleware/upload.js';

const router = Router();

router.post('/image', authRequired, imageUpload.single('image'), ctrl.uploadImage);

export default router;
