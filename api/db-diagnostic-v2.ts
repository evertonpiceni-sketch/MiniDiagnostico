import { promises as dns } from 'node:dns';

type Req = NodeJS.ReadableStream & { method?: string };
type Res = { status: (code: number) => Res; json: (data: unknown) => unknown };

const fail = (res: Res, code: string, stage: string, detail: string, extra: Record<string, unknown> = {}) =>
  res.status(code === 'DB_TIMEOUT' || code === 'DB_CONNECT_TIMEOUT' ? 504 : 503).json({ status: 'error', code, stage, detail, checkedAt: new Date().toISOString(), ...extra });

function classify(error: any) {
  const cause = error?.cause || {};
  const code = String(cause?.code || error?.code || '').toUpperCase();
  const name = String(error?.name || '');
  const message = String(error?.message || '').toLowerCase();
  if (name === 'AbortError') return { code: 'DB_TIMEOUT', detail: 'O Supabase não respondeu dentro do limite.' };
  if (code === 'ENOTFOUND') return { code: 'DB_DNS_ENOTFOUND', detail: 'O hostname do SUPABASE_URL não foi encontrado no DNS.' };
  if (code === 'EAI_AGAIN') return { code: 'DB_DNS_TEMPORARY', detail: 'A resolução DNS falhou temporariamente.' };
  if (code === 'ECONNREFUSED') return { code: 'DB_CONNECTION_REFUSED', detail: 'A conexão foi recusada pelo destino.' };
  if (code === 'ECONNRESET') return { code: 'DB_CONNECTION_RESET', detail: 'A conexão foi encerrada durante a tentativa.' };
  if (code === 'ETIMEDOUT' || code === 'UND_ERR_CONNECT_TIMEOUT') return { code: 'DB_CONNECT_TIMEOUT', detail: 'A conexão expirou antes de estabelecer comunicação.' };
  if (code.includes('CERT') || message.includes('certificate')) return { code: 'DB_TLS_ERROR', detail: 'Falha na validação TLS/HTTPS.' };
  if (message.includes('fetch failed')) return { code: 'DB_CONNECTION', detail: 'A Vercel não conseguiu estabelecer conexão HTTP com o Supabase.' };
  return { code: 'DB_CONNECTION', detail: 'Falha de conexão não classificada.' };
}

function config() {
  const url = (process.env.SUPABASE_URL || '').trim().replace(/\/$/, '');
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  if (!url) return { ok: false, code: 'DB_CONFIG_URL_MISSING', detail: 'SUPABASE_URL ausente.' };
  if (!key || key.length < 20) return { ok: false, code: 'DB_CONFIG_KEY_MISSING', detail: 'SUPABASE_SERVICE_ROLE_KEY ausente ou inválida.' };
  try {
    const u = new URL(url);
    if (u.protocol !== 'https:' || !u.hostname.endsWith('.supabase.co')) return { ok: false, code: 'DB_URL_INVALID', detail: 'SUPABASE_URL deve apontar para https://*.supabase.co.' };
    const keyType = key.startsWith('sb_secret_') ? 'secret' : key.startsWith('sb_publishable_') ? 'publishable' : key.startsWith('eyJ') ? 'jwt' : 'unknown';
    if (keyType === 'publishable') return { ok: false, code: 'DB_KEY_WRONG_TYPE', detail: 'A chave parece publishable/anon; o backend precisa de chave server-side.', hostname: u.hostname, keyType };
    return { ok: true, hostname: u.hostname, keyType };
  } catch { return { ok: false, code: 'DB_URL_INVALID', detail: 'SUPABASE_URL não é uma URL válida.' }; }
}

async function lookup(hostname: string) {
  try {
    const started = Date.now();
    const records = await dns.lookup(hostname, { all: true });
    return { ok: true, latencyMs: Date.now() - started, addresses: records.map((r) => r.address), families: [...new Set(records.map((r) => r.family))] };
  } catch (e: any) { return { ok: false, ...classify(e) }; }
}

async function http(url: string, key: string) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  const started = Date.now();
  try {
    const response = await fetch(url, { headers: { apikey: key, Authorization: `Bearer ${key}` }, signal: controller.signal });
    const text = await response.text();
    return { ok: response.ok, status: response.status, latencyMs: Date.now() - started, text };
  } finally { clearTimeout(timer); }
}

export default async function handler(req: Req, res: Res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Método não permitido.' });
  const checkedAt = new Date().toISOString();
  const cfg = config();
  if (!cfg.ok) return fail(res, cfg.code, 'configuration', cfg.detail, cfg);
  const url = (process.env.SUPABASE_URL || '').trim().replace(/\/$/, '');
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  const hostname = cfg.hostname;

  const dnsResult = await lookup(hostname);
  if (!dnsResult.ok) return fail(res, dnsResult.code, 'dns', dnsResult.detail, { checkedAt, hostname });

  try {
    const rest = await http(`${url}/rest/v1/`, key);
    if (!rest.ok) return fail(res, `DB_${rest.status}`, 'rest_endpoint', 'O endpoint REST respondeu com erro.', { checkedAt, hostname, keyType: cfg.keyType, httpStatus: rest.status, latencyMs: rest.latencyMs, responsePreview: rest.text.slice(0, 200) });

    const table = await http(`${url}/rest/v1/quiz_sessions?select=quiz_session_id&limit=1`, key);
    if (!table.ok) return fail(res, `DB_${table.status}`, 'quiz_sessions', 'O endpoint REST está acessível, mas a consulta à tabela falhou.', { checkedAt, hostname, keyType: cfg.keyType, httpStatus: table.status, latencyMs: table.latencyMs, responsePreview: table.text.slice(0, 200) });

    return res.status(200).json({ status: 'connected', code: 'DB_OK', stage: 'quiz_sessions', checkedAt, hostname, keyType: cfg.keyType, dns: dnsResult, restEndpoint: { status: rest.status, latencyMs: rest.latencyMs }, quizSessions: { status: table.status, latencyMs: table.latencyMs } });
  } catch (e: any) {
    const d = classify(e);
    return fail(res, d.code, 'http', d.detail, { checkedAt, hostname, keyType: cfg.keyType });
  }
}
