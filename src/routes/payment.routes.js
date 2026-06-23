import { Router } from 'express';
import { z } from 'zod';
import * as ctrl from '../controllers/paymentController.js';
import { authRequired } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { PAYMENT_METHODS, CHECKOUT_COUNTRIES } from '../constants.js';

const router = Router();

const initSchema = z.object({
  items: z.array(z.string().min(1)).min(1, 'At least one course is required'),
  paymentMethod: z.enum(PAYMENT_METHODS),
  billing: z.object({
    firstName: z.string().trim().min(1),
    lastName: z.string().trim().min(1),
    email: z.string().trim().toLowerCase().email(),
    country: z.enum(CHECKOUT_COUNTRIES),
  }),
});

router.post('/initialize', authRequired, validate({ body: initSchema }), ctrl.initialize);
router.post(
  '/verify',
  authRequired,
  validate({ body: z.object({ reference: z.string().min(1) }) }),
  ctrl.verify
);

// Webhook — raw body is parsed in server.js before the JSON parser; no auth.
router.post('/webhook/:provider', ctrl.webhook);

export default router;
