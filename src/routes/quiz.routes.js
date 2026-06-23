import { Router } from 'express';
import { z } from 'zod';
import * as ctrl from '../controllers/quizController.js';
import { authRequired } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';

const router = Router();

router.get('/course/:courseId/lecture/:lectureId', authRequired, ctrl.getQuiz);
router.post(
  '/:quizId/submit',
  authRequired,
  validate({ body: z.object({ answers: z.array(z.coerce.number()).default([]) }) }),
  ctrl.submitQuiz
);

export default router;
