import { Router } from 'express';
import * as ctrl from '../controllers/videoController.js';
import { authRequired, instructorOnly } from '../middleware/auth.js';
import { videoUpload } from '../middleware/upload.js';

const router = Router();

router.post('/upload', authRequired, instructorOnly, videoUpload.single('file'), ctrl.uploadVideo);
router.post('/create-upload', authRequired, instructorOnly, ctrl.createUpload);
// Bunny Stream status webhook (public — verified by matching the asset id).
router.post('/webhook/bunny', ctrl.bunnyWebhook);
router.get('/:assetId', authRequired, ctrl.getAsset);

export default router;
