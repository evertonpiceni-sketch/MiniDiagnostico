import test from 'node:test';
import assert from 'node:assert/strict';

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

function configureBaseEnv() {
  process.env.ADMIN_SESSION_SECRET = 'admin-session-secret-0123456789abcdef';
  process.env.JANAINA_TEST_PASSWORD = 'senha-teste-segura';
  delete process.env.JANAINA_ADMIN_PASSWORD;
}

test('login ADM informa erro de configuração quando a senha do suporte não existe', async () => {
  configureBaseEnv();
  const { default: handler } = await import(`../api/admin-login.ts?missing=${Date.now()}`);
  const req = { method: 'POST', body: { username: 'janainabrandao', password: 'qualquer' }, headers: { 'x-forwarded-for': '198.51.100.10' } };
  const res = makeResponse();
  handler(req, res);
  assert.equal(res.statusCode, 503);
  assert.match(res.body.error, /não está configurada corretamente/i);
});

test('login ADM aceita credencial configurada e emite sessão de suporte', async () => {
  process.env.ADMIN_SESSION_SECRET = 'admin-session-secret-0123456789abcdef';
  process.env.JANAINA_ADMIN_PASSWORD = 'senha-admin-segura';
  process.env.JANAINA_TEST_PASSWORD = 'senha-teste-segura';
  const { default: handler } = await import(`../api/admin-login.ts?valid=${Date.now()}`);
  const req = { method: 'POST', body: { username: 'janainabrandao', password: 'senha-admin-segura' }, headers: { 'x-forwarded-for': '198.51.100.11' } };
  const res = makeResponse();
  handler(req, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.ok, true);
  assert.equal(res.body.role, 'support');
  assert.equal(res.body.username, 'janainabrandao');
  assert.ok(res.body.admin_token);
});

test('login ADM rejeita senha incorreta sem expor detalhes', async () => {
  process.env.ADMIN_SESSION_SECRET = 'admin-session-secret-0123456789abcdef';
  process.env.JANAINA_ADMIN_PASSWORD = 'senha-admin-segura';
  process.env.JANAINA_TEST_PASSWORD = 'senha-teste-segura';
  const { default: handler } = await import(`../api/admin-login.ts?invalid=${Date.now()}`);
  const req = { method: 'POST', body: { username: 'janainabrandao', password: 'senha-errada' }, headers: { 'x-forwarded-for': '198.51.100.12' } };
  const res = makeResponse();
  handler(req, res);
  assert.equal(res.statusCode, 401);
  assert.equal(res.body.error, 'Usuário ou senha inválidos.');
});
