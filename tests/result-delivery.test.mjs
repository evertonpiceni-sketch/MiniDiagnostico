import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';

const SESSION_ID = '22222222-2222-4222-8222-222222222222';
const SECRET = 'abcdef0123456789abcdef0123456789abcdef0123456789';

function configureEnv() {
  process.env.RESULT_TOKEN_SECRET = SECRET;
  process.env.SUPABASE_URL = 'https://supabase.test';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service_role_test_key';
  delete process.env.SUPABASE_SECRET_KEY;
}

function resultToken() {
  return createHmac('sha256', SECRET).update(`result:${SESSION_ID}`).digest('base64url');
}

function makeResponse() {
  return {
    statusCode: 200,
    body: undefined,
    ended: undefined,
    headers: {},
    status(code) { this.statusCode = code; return this; },
    json(data) { this.body = data; return this; },
    end(data) { this.ended = data; return this; },
    setHeader(name, value) { this.headers[name] = value; },
  };
}

function paidRow() {
  return [{
    quiz_session_id: SESSION_ID,
    nome: 'Cliente Teste',
    score_medo: 2,
    score_inseguranca: 4,
    score_procrastinacao: 10,
    resultado_dominante: 'PROCRASTINAÇÃO',
    payment_status: 'paid',
    paid_at: '2026-09-09T10:00:00.000Z',
  }];
}

test('resultado pago exige token e entrega somente os dados autorizados', async () => {
  configureEnv();
  globalThis.fetch = async () => new Response(JSON.stringify(paidRow()), { status: 200 });
  const { default: handler } = await import(`../api/quiz/[id].ts?delivery=${Date.now()}`);

  const denied = makeResponse();
  await handler({ method: 'GET', query: { id: SESSION_ID, token: 'invalido' } }, denied);
  assert.equal(denied.statusCode, 403);

  const allowed = makeResponse();
  await handler({ method: 'GET', query: { id: SESSION_ID, token: resultToken() } }, allowed);
  assert.equal(allowed.statusCode, 200);
  assert.equal(allowed.body.resultado_dominante, 'PROCRASTINAÇÃO');
  assert.equal(allowed.body.payment_status, 'paid');
  assert.equal(allowed.headers['Cache-Control'], 'private, no-store');
  assert.equal('whatsapp' in allowed.body, false);
});

test('PDF pago exige token, confirma pagamento e retorna PDF privado', async () => {
  configureEnv();
  globalThis.fetch = async () => new Response(JSON.stringify(paidRow()), { status: 200 });
  const { default: handler } = await import(`../api/diagnostico-pdf.ts?delivery=${Date.now()}`);

  const denied = makeResponse();
  await handler({ method: 'GET', query: { id: SESSION_ID, token: 'invalido' } }, denied);
  assert.equal(denied.statusCode, 403);

  const allowed = makeResponse();
  await handler({ method: 'GET', query: { id: SESSION_ID, token: resultToken() } }, allowed);
  assert.equal(allowed.statusCode, 200);
  assert.equal(allowed.headers['Content-Type'], 'application/pdf');
  assert.equal(allowed.headers['Cache-Control'], 'private, no-store');
  assert.ok(Buffer.isBuffer(allowed.ended));
  assert.equal(allowed.ended.subarray(0, 5).toString('latin1'), '%PDF-');
});
