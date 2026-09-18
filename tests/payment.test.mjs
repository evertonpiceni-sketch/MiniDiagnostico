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
  return new Response(null, { status });
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


test('PIX cria nova cobrança quando a sessão tinha cobrança de cartão', async () => {
  configureEnv();
  const calls = [];
  globalThis.fetch = async (url, init = {}) => {
    calls.push({ url: String(url), init });
    const u = String(url);
    if (u.includes('/rest/v1/quiz_sessions?') && init.method === 'PATCH') return emptyResponse();
    if (u.includes('/rest/v1/quiz_sessions?') && (!init.method || init.method === 'GET')) {
      return jsonResponse([{ quiz_session_id: SESSION_ID, nome: 'Cliente Teste', whatsapp: '5511999999999', payment_status: 'pending', asaas_payment_id: 'pay_card_old' }]);
    }
    if (u.endsWith('/payments/pay_card_old')) {
      return jsonResponse({ id: 'pay_card_old', externalReference: SESSION_ID, value: 9.90, billingType: 'CREDIT_CARD', status: 'PENDING' });
    }
    if (u.includes('/customers?externalReference=')) return jsonResponse({ data: [{ id: 'cus_existing' }] });
    if (u.endsWith('/payments') && init.method === 'POST') return jsonResponse({ id: 'pay_pix_new', status: 'PENDING' });
    if (u.endsWith('/payments/pay_pix_new/pixQrCode')) return jsonResponse({ payload: 'PIXNOVO', encodedImage: 'PNGBASE64' });
    throw new Error(`Unexpected fetch: ${u}`);
  };

  const { default: handler } = await import(`../api/asaas-pix.ts?switch=${Date.now()}`);
  const res = makeResponse();
  await handler({ method: 'POST', body: { quiz_session_id: SESSION_ID, cpfCnpj: '52998224725' }, headers: { host: 'mini.example' } }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.ok, true);
  assert.equal(res.body.payload, 'PIXNOVO');
  const created = calls.find((call) => call.url.endsWith('/payments') && call.init.method === 'POST');
  assert.ok(created, 'deve criar nova cobrança PIX em vez de falhar por causa do cartão anterior');
  assert.equal(JSON.parse(created.init.body).billingType, 'PIX');
});

test('webhook reconhece pagamento válido da sessão mesmo após troca da forma de pagamento', async () => {
  configureEnv();
  process.env.ASAAS_WEBHOOK_TOKEN = 'webhook-test-token';
  let patchUrl = '';
  let patchBody = null;
  globalThis.fetch = async (url, init = {}) => {
    const u = String(url);
    if (u.includes('/rest/v1/quiz_sessions?') && init.method === 'PATCH') {
      patchUrl = u;
      patchBody = JSON.parse(init.body);
      return jsonResponse([{ quiz_session_id: SESSION_ID }], 200);
    }
    throw new Error(`Unexpected fetch: ${u}`);
  };

  const { default: handler } = await import(`../api/asaas-webhook.ts?switch=${Date.now()}`);
  const res = makeResponse();
  await handler({
    method: 'POST',
    headers: { 'asaas-access-token': 'webhook-test-token' },
    body: {
      event: 'PAYMENT_RECEIVED',
      payment: {
        id: 'pay_pix_old_but_paid',
        externalReference: SESSION_ID,
        value: 9.90,
        billingType: 'PIX',
        status: 'RECEIVED',
      },
    },
  }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.updated, true);
  assert.equal(patchUrl.includes('asaas_payment_id=eq.'), false, 'não deve rejeitar cobrança válida só porque outra tentativa foi salva depois');
  assert.equal(patchBody.payment_status, 'paid');
  assert.equal(patchBody.asaas_payment_id, 'pay_pix_old_but_paid');
  assert.equal(patchBody.payment_method_selected, 'pix_asaas');
});

test('cada diagnóstico concluído cria uma sessão nova, sem reaproveitar pendência anterior', async () => {
  configureEnv();
  process.env.SUPABASE_URL = 'https://mini-test.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service_role_test_key_123456789';
  const calls = [];
  globalThis.fetch = async (url, init = {}) => {
    calls.push({ url: String(url), init });
    const u = String(url);
    if (u.endsWith('/rest/v1/quiz_sessions') && init.method === 'POST') return emptyResponse();
    if (u.includes('/rest/v1/quiz_sessions?') && (!init.method || init.method === 'GET')) {
      throw new Error('não deve procurar sessão pendente duplicada');
    }
    throw new Error(`Unexpected fetch: ${u}`);
  };

  const { default: handler } = await import(`../api/quiz.ts?fresh=${Date.now()}`);
  const res = makeResponse();
  const respostas = Object.fromEntries(Array.from({ length: 12 }, (_, i) => [String(i + 1), i < 4 ? 3 : i < 8 ? 1 : 0]));
  await handler({
    method: 'POST',
    headers: {},
    body: { nome: 'Cliente Novo', whatsapp: '11999999999', respostas },
  }, res);

  assert.equal(res.statusCode, 201);
  assert.equal(res.body.ok, true);
  assert.match(res.body.quiz_session_id, /^[0-9a-f-]{36}$/i);
  assert.equal(calls.some((call) => call.url.includes('payment_status=eq.pending')), false);
});

test('link público não recupera sessão ou resultado antigo do navegador', async () => {
  const fs = await import('node:fs/promises');
  const app = await fs.readFile(new URL('../src/App.tsx', import.meta.url), 'utf8');
  const recovery = await fs.readFile(new URL('../src/post-payment-recovery.ts', import.meta.url), 'utf8');

  assert.equal(app.includes("get('session_id') || localStorage.getItem('quiz_session_id')"), false);
  assert.equal(app.includes("window.location.pathname === '/' && recoverableSessionId"), false);
  assert.equal(recovery.includes("window.location.replace(recoveryUrl!)"), false);
  assert.equal(recovery.includes("if (path === '/')"), true);
  assert.equal(recovery.includes("clearRecovery();"), true);
});
