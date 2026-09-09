import test from 'node:test';
import assert from 'node:assert/strict';
import { enforceRateLimit } from '../api/_rate-limit.js';

function makeReq(ip = '203.0.113.10') {
  return { headers: { 'x-forwarded-for': ip } };
}

function makeRes() {
  const headers = new Map();
  let statusCode = 200;
  let payload;
  return {
    setHeader(name, value) { headers.set(String(name).toLowerCase(), String(value)); },
    status(code) { statusCode = code; return this; },
    json(value) { payload = value; },
    get headers() { return headers; },
    get statusCode() { return statusCode; },
    get payload() { return payload; },
  };
}

test('rate limiter permite até o limite e bloqueia a tentativa seguinte com 429', () => {
  const req = makeReq();
  const scope = `test-basic-${Date.now()}-${Math.random()}`;

  const first = makeRes();
  assert.equal(enforceRateLimit(req, first, scope, 2, 60_000), true);
  assert.equal(first.headers.get('x-ratelimit-limit'), '2');
  assert.equal(first.headers.get('x-ratelimit-remaining'), '1');

  const second = makeRes();
  assert.equal(enforceRateLimit(req, second, scope, 2, 60_000), true);
  assert.equal(second.headers.get('x-ratelimit-remaining'), '0');

  const third = makeRes();
  assert.equal(enforceRateLimit(req, third, scope, 2, 60_000), false);
  assert.equal(third.statusCode, 429);
  assert.match(third.payload?.error || '', /Muitas tentativas/i);
  assert.ok(Number(third.headers.get('retry-after')) >= 1);
});

test('rate limiter separa clientes e escopos', () => {
  const scope = `test-isolation-${Date.now()}-${Math.random()}`;
  const a = makeRes();
  const b = makeRes();
  assert.equal(enforceRateLimit(makeReq('203.0.113.11'), a, scope, 1, 60_000), true);
  assert.equal(enforceRateLimit(makeReq('203.0.113.12'), b, scope, 1, 60_000), true);

  const otherScope = makeRes();
  assert.equal(enforceRateLimit(makeReq('203.0.113.11'), otherScope, `${scope}-other`, 1, 60_000), true);
});

test('rate limiter libera novamente após expirar a janela', async () => {
  const req = makeReq('203.0.113.13');
  const scope = `test-reset-${Date.now()}-${Math.random()}`;
  const first = makeRes();
  assert.equal(enforceRateLimit(req, first, scope, 1, 5), true);

  const blocked = makeRes();
  assert.equal(enforceRateLimit(req, blocked, scope, 1, 5), false);

  await new Promise(resolve => setTimeout(resolve, 15));
  const afterReset = makeRes();
  assert.equal(enforceRateLimit(req, afterReset, scope, 1, 5), true);
  assert.equal(afterReset.headers.get('x-ratelimit-remaining'), '0');
});
