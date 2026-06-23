import { Router } from 'express';
import * as ctrl from '../controllers/applicationController.js';
import { authRequired } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { cvUpload } from '../middleware/upload.js';
import { applySchema, applicationStatusSchema } from '../validators/jobValidators.js';

const router = Router();

router.post(
  '/',
  authRequired,
  cvUpload.single('cv'),
  validate({ body: applySchema }),
  ctrl.apply
);
router.get('/me', authRequired, ctrl.myApplications);
router.get('/posted-by-me', authRequired, ctrl.applicationsForMyJobs);
router.get('/check', authRequired, ctrl.checkApplied);
router.get('/job/:jobId', authRequired, ctrl.applicationsForJob);
router.patch('/:id/status', authRequired, validate({ body: applicationStatusSchema }), ctrl.updateStatus);
router.post('/upload-cv', authRequired, cvUpload.single('cv'), ctrl.uploadCv);

export default router;
