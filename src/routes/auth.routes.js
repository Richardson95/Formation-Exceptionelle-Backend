import { Router } from 'express';
import * as ctrl from '../controllers/authController.js';
import { authRequired } from '../middleware/auth.js';
import { authLimiter } from '../middleware/rateLimit.js';
import { validate } from '../middleware/validate.js';
import {
  registerSchema,
  loginSchema,
  updateMeSchema,
  becomeInstructorSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  verifyTokenQuerySchema,
} from '../validators/authValidators.js';

const router = Router();

router.post('/register', authLimiter, validate({ body: registerSchema }), ctrl.register);
router.post('/login', authLimiter, validate({ body: loginSchema }), ctrl.login);
router.post('/logout', authRequired, ctrl.logout);
router.get('/me', authRequired, ctrl.me);
router.patch('/me', authRequired, validate({ body: updateMeSchema }), ctrl.updateMe);
router.post(
  '/become-instructor',
  authRequired,
  validate({ body: becomeInstructorSchema }),
  ctrl.becomeInstructor
);

router.post(
  '/forgot-password',
  authLimiter,
  validate({ body: forgotPasswordSchema }),
  ctrl.forgotPassword
);
router.get(
  '/verify-reset-token',
  validate({ query: verifyTokenQuerySchema }),
  ctrl.verifyResetToken
);
router.post(
  '/reset-password',
  authLimiter,
  validate({ body: resetPasswordSchema }),
  ctrl.resetPassword
);

export default router;
