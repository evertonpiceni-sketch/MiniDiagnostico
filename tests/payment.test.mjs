import test from 'node:test';
import assert from 'node:assert/strict';

const SESSION_ID = '11111111-1111-4111-8111-111111111111';
const SECRET = '0123456789abcdef0123456789abcdef0123456789abcdef';

function makeResponse() {
  return {
    statusCode: 200,
    body: undefined,
    headers: {},
    status(code) { this.statusCode = code; return this; },
    json(data) { this.body = data; },
    setHeader(name, value) { this.headers[name] = value; },
  };
}

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

function emptyResponse(status = 204) {
  return new Response('', { status });
}

function configureEnv() {
  process.env.ASAAS_API_KEY = 'test_asaas_key';
  process.env.ASAAS_API_URL = 'https://asaas.test/v3';
  process.env.RESULT_TOKEN_SECRET = SECRET;
  process.env.APP_URL = 'https://mini.example';
  process.env.SUPABASE_URL = 'https://supabase.test';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service_role_test_key';
  delete process.env.SUPABASE_SECRET_KEY;
}

test('cartão usa somente Asaas, mantém R$ 9,90 e vincula cobrança à sessão', async () => {
  configureEnv();
  const calls = [];
  globalThis.fetch = async (url, init = {}) => {
    calls.push({ url: String(url), init });
    const u = String(url);
    if (u.includes('/rest/v1/quiz_sessions?') && (!init.method || init.method === 'GET')) {
      return jsonResponse([{ quiz_session_id: SESSION_ID, nome: 'Cliente Teste', whatsapp: '5511999999999', payment_status: 'pending', asaas_payment_id: null, payment_method_selected: null }]);
    }
    if (u.includes('/customers?externalReference=')) return jsonResponse({ data: [] });
    if (u.endsWith('/customers') && init.method === 'POST') return jsonResponse({ id: 'cus_123' });
    if (u.endsWith('/payments') && init.method === 'POST') return jsonResponse({ id: 'pay_card_123', invoiceUrl: 'https://asaas.test/invoice/pay_card_123' });
    if (u.includes('/rest/v1/quiz_sessions?') && init.method === 'PATCH') return emptyResponse();
    throw new Error(`Unexpected fetch: ${u}`);
  };

  const { default: handler } = await import(`../api/checkout.ts?test=${Date.now()}`);
  const req = { method: 'POST', body: { quiz_session_id: SESSION_ID }, headers: { host: 'mini.example' } };
  const res = makeResponse();
  await handler(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.ok, true);
  assert.equal(res.body.url, 'https://asaas.test/invoice/pay_card_123');
  assert.ok(res.body.token);

  const paymentCall = calls.find((c) => c.url.endsWith('/payments') && c.init.method === 'POST');
  assert.ok(paymentCall, 'deve criar cobrança no Asaas');
  const payload = JSON.parse(paymentCall.init.body);
  assert.equal(payload.billingType, 'CREDIT_CARD');
  assert.equal(payload.value, 9.90);
  assert.equal(payload.externalReference, SESSION_ID);
  assert.equal(payload.callback.successUrl.startsWith(`https://mini.example/resultado?session_id=${SESSION_ID}`), true);
  assert.equal(calls.some((c) => /stripe/i.test(c.url)), false);
});

test('PIX usa Asaas, mantém R$ 9,90 e retorna QR Code/copia e cola', async () => {
  configureEnv();
  const calls = [];
  globalThis.fetch = async (url, init = {}) => {
    calls.push({ url: String(url), init });
    const u = String(url);
    if (u.includes('/rest/v1/quiz_sessions?') && init.method === 'PATCH') return emptyResponse();
    if (u.includes('/rest/v1/quiz_sessions?') && (!init.method || init.method === 'GET')) {
      return jsonResponse([{ quiz_session_id: SESSION_ID, nome: 'Cliente Teste', whatsapp: '5511999999999', payment_status: 'pending', asaas_payment_id: null }]);
    }
    if (u.includes('/customers?externalReference=')) return jsonResponse({ data: [] });
    if (u.endsWith('/customers') && init.method === 'POST') return jsonResponse({ id: 'cus_pix_123' });
    if (u.endsWith('/payments') && init.method === 'POST') return jsonResponse({ id: 'pay_pix_123', status: 'PENDING' });
    if (u.endsWith('/payments/pay_pix_123/pixQrCode')) return jsonResponse({ payload: '000201PIXTESTE', encodedImage: 'iVBORw0KGgoAAA', expirationDate: '2026-09-09T23:59:59Z' });
    throw new Error(`Unexpected fetch: ${u}`);
  };

  const { default: handler } = await import(`../api/asaas-pix.ts?test=${Date.now()}`);
  const req = { method: 'POST', body: { quiz_session_id: SESSION_ID, cpfCnpj: '52998224725' }, headers: { host: 'mini.example' } };
  const res = makeResponse();
  await handler(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.ok, true);
  assert.equal(res.body.paid, false);
  assert.equal(res.body.payload, '000201PIXTESTE');
  assert.equal(res.body.encodedImage, 'iVBORw0KGgoAAA');

  const paymentCall = calls.find((c) => c.url.endsWith('/payments') && c.init.method === 'POST');
  assert.ok(paymentCall, 'deve criar cobrança PIX no Asaas');
  const payload = JSON.parse(paymentCall.init.body);
  assert.equal(payload.billingType, 'PIX');
  assert.equal(payload.value, 9.90);
  assert.equal(payload.externalReference, SESSION_ID);
  assert.equal(calls.some((c) => /stripe/i.test(c.url)), false);
});
