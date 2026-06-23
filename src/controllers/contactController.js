import asyncHandler from '../utils/asyncHandler.js';
import { sendContactEmail } from '../services/mailer.js';

// POST /api/contact — landing-page contact form → notify admin / store as a lead.
export const submitContact = asyncHandler(async (req, res) => {
  const lead = req.body;
  sendContactEmail(lead).catch(() => {});
  res.status(201).json({ success: true, message: 'Thanks for reaching out — we will be in touch soon.' });
});
