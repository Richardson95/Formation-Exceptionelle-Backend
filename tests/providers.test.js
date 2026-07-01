import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// These unit tests exercise the provider seams in mock mode (no network) and
// verify the real branch is taken when credentials are present (with fetch
// stubbed). They complement the full e2e smoke test (`npm run smoke`).

describe('paymentProvider (mock mode)', () => {
  beforeEach(() => vi.resetModules());

  it('initialize + verify succeed without credentials', async () => {
    const { initializePayment, verifyPayment } = await import('../src/services/paymentProvider.js');
    const init = await initializePayment({ order: { id: 'o1', total: 35000 }, email: 'a@b.com' });
    expect(init.provider).toBe('mock');
    expect(init.reference).toMatch(/^FE_/);
    expect(init.authorizationUrl).toContain('reference=');

    const res = await verifyPayment({ reference: init.reference });
    expect(res.success).toBe(true);
  });
});

describe('paymentProvider (paystack mode)', () => {
  const realFetch = global.fetch;
  beforeEach(() => {
    vi.resetModules();
    process.env.PAYMENT_PROVIDER = 'paystack';
    process.env.PAYSTACK_SECRET_KEY = 'sk_test_x';
    process.env.PAYSTACK_PUBLIC_KEY = 'pk_test_x';
  });
  afterEach(() => {
    global.fetch = realFetch;
    delete process.env.PAYMENT_PROVIDER;
    delete process.env.PAYSTACK_SECRET_KEY;
    delete process.env.PAYSTACK_PUBLIC_KEY;
  });

  it('initialize calls Paystack and returns the authorization url', async () => {
    global.fetch = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        status: true,
        data: { reference: 'ref_123', authorization_url: 'https://paystack/pay/ref_123', access_code: 'ac' },
      }),
    }));
    const { initializePayment } = await import('../src/services/paymentProvider.js');
    const init = await initializePayment({ order: { id: 'o1', total: 35000 }, email: 'a@b.com' });
    expect(global.fetch).toHaveBeenCalledOnce();
    const [, opts] = global.fetch.mock.calls[0];
    // Amount must be sent in kobo.
    expect(JSON.parse(opts.body).amount).toBe(3500000);
    expect(init.provider).toBe('paystack');
    expect(init.authorizationUrl).toBe('https://paystack/pay/ref_123');
  });
});

describe('videoProvider (mock mode)', () => {
  beforeEach(() => vi.resetModules());

  it('direct upload returns a ready local asset', async () => {
    const { handleDirectUpload } = await import('../src/services/videoProvider.js');
    const asset = await handleDirectUpload({
      file: { path: '/tmp/foo.mp4', originalname: 'foo.mp4', size: 10 },
      baseUrl: 'http://localhost:5000',
    });
    expect(asset.provider).toBe('mock');
    expect(asset.status).toBe('ready');
    expect(asset.playbackUrl).toContain('/uploads/videos/');
  });
});

describe('storageProvider (local mode)', () => {
  beforeEach(() => vi.resetModules());

  it('keyFor builds a clean object key', async () => {
    const { keyFor } = await import('../src/services/storageProvider.js');
    expect(keyFor('images', 'a.png')).toBe('images/a.png');
    expect(keyFor('/cvs', 'b.pdf')).toBe('cvs/b.pdf');
  });

  it('is not remote without R2 credentials', async () => {
    const { isRemote } = await import('../src/services/storageProvider.js');
    expect(isRemote).toBe(false);
  });
});
