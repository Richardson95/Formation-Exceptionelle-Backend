import asyncHandler from '../utils/asyncHandler.js';
import ApiError from '../utils/ApiError.js';
import Order from '../models/Order.js';
import Course from '../models/Course.js';
import Enrollment from '../models/Enrollment.js';
import { fulfillOrder } from '../services/orderService.js';
import * as gateway from '../services/paymentProvider.js';

const list = (titles) => titles.join(', ');

/**
 * Create a pending order from server-authoritative course prices and return the
 * gateway init payload. Never trusts client totals.
 */
export const initialize = asyncHandler(async (req, res) => {
  const { items, paymentMethod, billing } = req.body;

  const courses = await Course.find({ _id: { $in: items } });
  if (courses.length === 0) throw ApiError.badRequest('No valid courses in order');

  // Nobody pays twice for the same course. The client hides the buy buttons once
  // you own a course, but it decides that from a list it may not have loaded, so
  // the refusal has to live here — this is the only place that takes the money.
  const owned = await Enrollment.find({
    userId: req.userId,
    courseId: { $in: courses.map((c) => c.id) },
  }).select('courseId');

  if (owned.length > 0) {
    const ownedIds = new Set(owned.map((e) => e.courseId));
    const titles = courses.filter((c) => ownedIds.has(c.id)).map((c) => c.title);
    throw ApiError.badRequest(
      `You are already enrolled in ${list(titles)}.`,
      'already_enrolled'
    );
  }

  // An instructor already has access to their own course; charging them for it
  // would just move money in a circle.
  const own = courses.filter((c) => String(c.instructorId) === String(req.userId));
  if (own.length > 0) {
    throw ApiError.badRequest(
      `You cannot buy your own course (${list(own.map((c) => c.title))}).`,
      'own_course'
    );
  }

  const orderItems = courses.map((c) => ({ courseId: c.id, title: c.title, price: c.price }));
  const subtotal = courses.reduce((s, c) => s + (c.originalPrice || c.price || 0), 0);
  const total = courses.reduce((s, c) => s + (c.price || 0), 0);
  const savings = Math.max(0, subtotal - total);

  const order = await Order.create({
    userId: req.userId,
    items: orderItems,
    subtotal,
    savings,
    total,
    currency: 'NGN',
    paymentMethod,
    billing,
    status: 'pending',
  });

  const init = await gateway.initializePayment({
    order,
    email: billing?.email || req.user.email,
  });

  order.paymentProvider = init.provider;
  order.providerReference = init.reference;
  await order.save();

  res.status(201).json({
    orderId: order.id,
    provider: init.provider,
    reference: init.reference,
    authorizationUrl: init.authorizationUrl,
    publicKey: init.publicKey,
    total,
    currency: 'NGN',
  });
});

export const verify = asyncHandler(async (req, res) => {
  const { reference } = req.body;
  const order = await Order.findOne({ providerReference: reference, userId: req.userId });
  if (!order) throw ApiError.notFound('Order not found');

  const result = await gateway.verifyPayment({ reference });
  if (!result.success) {
    order.status = 'failed';
    await order.save();
    throw ApiError.badRequest('Payment could not be verified', 'payment_failed');
  }

  await fulfillOrder(order);

  const courses = await Course.find({ _id: { $in: order.items.map((i) => i.courseId) } });
  res.json({ success: true, order, courses });
});

export const webhook = asyncHandler(async (req, res) => {
  const provider = req.params.provider;
  const rawBody = req.body instanceof Buffer ? req.body.toString('utf8') : JSON.stringify(req.body);
  const signature =
    req.headers['x-paystack-signature'] || req.headers['stripe-signature'] || '';

  const valid = gateway.verifyWebhookSignature({ provider, rawBody, signature });
  if (!valid) throw ApiError.unauthorized('Invalid webhook signature');

  let event;
  try {
    event = JSON.parse(rawBody);
  } catch {
    event = {};
  }

  // Paystack: { event: 'charge.success', data: { reference } }
  const reference = event?.data?.reference;
  if (reference) {
    const order = await Order.findOne({ providerReference: reference });
    if (order) await fulfillOrder(order);
  }

  res.json({ received: true });
});
