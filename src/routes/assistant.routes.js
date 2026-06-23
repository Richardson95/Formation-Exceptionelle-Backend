import { Router } from 'express';
import { z } from 'zod';
import * as ctrl from '../controllers/assistantController.js';
import { authOptional } from '../middleware/auth.js';
import { aiLimiter } from '../middleware/rateLimit.js';
import { validate } from '../middleware/validate.js';

const router = Router();

const chatSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string(),
      })
    )
    .min(1),
  context: z.any().optional(),
});

router.post('/chat', aiLimiter, authOptional, validate({ body: chatSchema }), ctrl.chat);

export default router;
