import asyncHandler from '../utils/asyncHandler.js';
import ApiError from '../utils/ApiError.js';
import Order from '../models/Order.js';
import Course from '../models/Course.js';
import { fulfillOrder } from '../services/orderService.js';
import * as gateway from '../services/paymentProvider.js';

/**
 * Create a pending order from server-authoritative course prices and return the
 * gateway init payload. Never trusts client totals.
 */
export const initialize = asyncHandler(async (req, res) => {
  const { items, paymentMethod, billing } = req.body;

  const courses = await Course.find({ _id: { $in: items } });
  if (courses.length === 0) throw ApiError.badRequest('No valid courses in order');

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
    currency: 'USD',
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
    reference: init.reference,
    authorizationUrl: init.authorizationUrl,
    publicKey: init.publicKey,
    total,
    currency: 'USD',
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
