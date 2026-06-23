import { Router } from 'express';
import { z } from 'zod';
import * as ctrl from '../controllers/contactController.js';
import { validate } from '../middleware/validate.js';
import { authLimiter } from '../middleware/rateLimit.js';

const router = Router();

const contactSchema = z.object({
  name: z.string().trim().min(1, 'Name is required'),
  email: z.string().trim().toLowerCase().email(),
  phone: z.string().optional().default(''),
  subject: z.string().optional().default(''),
  message: z.string().trim().min(1, 'Message is required'),
});

router.post('/', authLimiter, validate({ body: contactSchema }), ctrl.submitContact);

export default router;
