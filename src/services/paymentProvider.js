import crypto from 'crypto';
import env from '../config/env.js';

/**
 * Payment provider abstraction.
 *
 * - `mock` (default): no gateway calls. `initialize` returns a fake authorization
 *   URL + reference; `verify` always succeeds. Lets the full checkout → enrollment
 *   flow run end-to-end without credentials.
 * - `paystack`: real calls to https://api.paystack.co. Activates only when
 *   PAYMENT_PROVIDER=paystack and PAYSTACK_SECRET_KEY is set (env.paystackEnabled).
 *
 * Amounts are NGN; Paystack works in kobo, so we multiply/divide by 100.
 */

const PAYSTACK_BASE = 'https://api.paystack.co';
const newRef = () => `FE_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`;

async function paystack(path, { method = 'GET', body } = {}) {
  const res = await fetch(`${PAYSTACK_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${env.PAYSTACK_SECRET_KEY}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.status === false) {
    const msg = json.message || `Paystack request failed (${res.status})`;
    const err = new Error(msg);
    err.providerResponse = json;
    throw err;
  }
  return json;
}

export async function initializePayment({ order, email }) {
  if (env.paystackEnabled) {
    const reference = newRef();
    const callback = env.PAYSTACK_CALLBACK_URL || `${env.SITE_ORIGIN}/lms/checkout`;
    const data = await paystack('/transaction/initialize', {
      method: 'POST',
      body: {
        email,
        amount: Math.round(order.total * 100), // NGN -> kobo
        currency: 'NGN',
        reference,
        callback_url: callback,
        metadata: { orderId: order.id, userId: String(order.userId) },
      },
    });
    return {
      provider: 'paystack',
      reference: data.data.reference,
      authorizationUrl: data.data.authorization_url,
      accessCode: data.data.access_code,
      publicKey: env.PAYSTACK_PUBLIC_KEY,
    };
  }

  // Mock
  const reference = newRef();
  return {
    provider: 'mock',
    reference,
    authorizationUrl: `${env.SITE_ORIGIN}/checkout/mock-pay?reference=${reference}`,
    publicKey: env.PAYSTACK_PUBLIC_KEY || 'pk_mock',
  };
}

export async function verifyPayment({ reference }) {
  if (env.paystackEnabled) {
    const data = await paystack(`/transaction/verify/${encodeURIComponent(reference)}`);
    const tx = data.data || {};
    return {
      provider: 'paystack',
      success: tx.status === 'success',
      amount: typeof tx.amount === 'number' ? tx.amount / 100 : undefined,
      reference: tx.reference || reference,
      raw: tx,
    };
  }

  // Mock: treat every reference as paid.
  return { success: true, reference, provider: 'mock' };
}

/** Issue a refund (admin panel). Mock just succeeds. */
export async function refundPayment({ reference, amount }) {
  if (env.paystackEnabled) {
    const data = await paystack('/refund', {
      method: 'POST',
      body: {
        transaction: reference,
        ...(amount ? { amount: Math.round(amount * 100) } : {}),
      },
    });
    return { provider: 'paystack', success: true, raw: data.data };
  }
  return { provider: 'mock', success: true };
}

/**
 * Verify a webhook signature. Fails closed: an unknown provider, a missing
 * secret or a missing signature is never trusted. The provider comes straight
 * from the request URL, so trusting anything that is not `paystack` would let
 * anyone mark an order paid by POSTing to /payments/webhook/<anything>.
 */
export function verifyWebhookSignature({ provider, rawBody, signature }) {
  if (provider !== 'paystack') return false;
  if (!env.PAYSTACK_SECRET_KEY || !signature) return false;

  const hash = crypto.createHmac('sha512', env.PAYSTACK_SECRET_KEY).update(rawBody).digest('hex');
  const a = Buffer.from(hash, 'utf8');
  const b = Buffer.from(String(signature), 'utf8');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
