import asyncHandler from '../utils/asyncHandler.js';
import { generateReply } from '../services/ai.js';

export const chat = asyncHandler(async (req, res) => {
  const { messages } = req.body;
  const result = await generateReply({ messages });
  res.json(result);
});
