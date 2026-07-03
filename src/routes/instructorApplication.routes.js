import { Router } from 'express';
import { z } from 'zod';
import * as ctrl from '../controllers/instructorApplicationController.js';
import { authRequired } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { cvUpload } from '../middleware/upload.js';

const router = Router();

// multipart/form-data (resume file + text fields), so validate a lenient body.
const applySchema = z.object({
  fullName: z.string().trim().optional(),
  email: z.string().trim().email().optional(),
  title: z.string().trim().min(1, 'Your professional title is required'),
  experience: z.string().trim().optional(),
  courseTopic: z.string().trim().optional(),
  category: z.string().trim().optional(),
  linkedin: z.string().trim().optional(),
  bio: z.string().trim().optional(),
  motivation: z.string().trim().optional(),
});

router.post('/', authRequired, cvUpload.single('resume'), validate({ body: applySchema }), ctrl.apply);
router.get('/me', authRequired, ctrl.myApplication);

export default router;
