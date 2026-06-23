import mongoose from 'mongoose';
import { baseSchemaOptions } from './_shared.js';
import { PAYMENT_METHODS, ORDER_STATUS } from '../constants.js';

const orderItemSchema = new mongoose.Schema(
  {
    courseId: { type: String, required: true },
    title: { type: String, default: '' },
    price: { type: Number, default: 0 },
  },
  { _id: false }
);

const billingSchema = new mongoose.Schema(
  {
    firstName: String,
    lastName: String,
    email: String,
    country: String,
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, index: true },
    items: { type: [orderItemSchema], default: [] },
    subtotal: { type: Number, default: 0 },
    savings: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
    currency: { type: String, default: 'USD' },
    paymentMethod: { type: String, enum: PAYMENT_METHODS, default: 'card' },
    paymentProvider: { type: String, default: '' },
    providerReference: { type: String, index: true },
    billing: { type: billingSchema, default: () => ({}) },
    status: { type: String, enum: ORDER_STATUS, default: 'pending', index: true },
    paidAt: { type: Date, default: null },
  },
  baseSchemaOptions()
);

const Order = mongoose.model('Order', orderSchema);
export default Order;
