import crypto from 'crypto';
import env from '../config/env.js';

/**
 * Payment provider abstraction.
 *
 * - `mock` (default): no gateway calls. `initialize` returns a fake authorization
 *   URL + reference; `verify` always succeeds. Lets the full checkout → enrollment
 *   flow be exercised end-to-end without credentials.
 * - `paystack`: real calls (TODO — fill in fetch to https://api.paystack.co).
 * - `stripe`: PaymentIntent flow (TODO).
 */

const newRef = () => `FE_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`;

export async function initializePayment({ order, email }) {
  const provider = env.PAYMENT_PROVIDER;

  if (provider === 'paystack' && env.PAYSTACK_SECRET_KEY) {
    // TODO: POST https://api.paystack.co/transaction/initialize
    //   body: { email, amount: order.total * 100 (kobo/cents), reference, callback_url }
    //   return { authorizationUrl: data.authorization_url, reference: data.reference }
  }

  const reference = newRef();
  return {
    provider: 'mock',
    reference,
    authorizationUrl: `${env.CLIENT_ORIGIN}/checkout/mock-pay?reference=${reference}`,
    publicKey: env.PAYSTACK_PUBLIC_KEY || 'pk_mock',
  };
}

export async function verifyPayment({ reference }) {
  const provider = env.PAYMENT_PROVIDER;

  if (provider === 'paystack' && env.PAYSTACK_SECRET_KEY) {
    // TODO: GET https://api.paystack.co/transaction/verify/:reference
    //   return { success: data.status === 'success', amount: data.amount / 100, reference }
  }

  // Mock: treat every reference as paid.
  return { success: true, reference, provider: 'mock' };
}

/** Verify a webhook signature (provider-specific). Mock always trusts. */
export function verifyWebhookSignature({ provider, rawBody, signature }) {
  if (provider === 'paystack' && env.PAYSTACK_SECRET_KEY) {
    const hash = crypto
      .createHmac('sha512', env.PAYSTACK_SECRET_KEY)
      .update(rawBody)
      .digest('hex');
    return hash === signature;
  }
  return true; // mock / unconfigured
}
