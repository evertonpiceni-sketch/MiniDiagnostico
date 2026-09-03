import { randomUUID } from 'node:crypto';
import dns from 'node:dns';

type Req = NodeJS.ReadableStream & {
  method?: string;
  url?: string;
  query: Record<string, string | string[] | undefined>;
  headers: Record<string, string | string[] | undefined>;
};
type Res = { status: (code: number) => Res; json: (data: unknown) => unknown };

export const config = { api: { bodyParser: false } };

try { dns.setDefaultResultOrder('ipv4first'); } catch {}

const cleanEnv = (value: string | undefined) => {
  const trimmed = (value || '').trim();
  return trimmed.replace(/^(["'])(.*)\1$/, '$2').trim();
};

const send = (res: Res, status: number, data: unknown) => res.status(status).json(data);
const validId = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);

function dbConfig() {
  const rawUrl = cleanEnv(process.env.SUPABASE_URL).replace(/\/$/, '');
  const key = cleanEnv(process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY);
  if (!rawUrl) throw new Error('DB_CONFIG_URL_MISSING');
  if (!key || key.length < 20) throw new Error('DB_CONFIG_KEY_MISSING');

  let parsed: URL;
  try { parsed = new URL(rawUrl); } catch { throw new Error('DB_URL_INVALID'); }
  if (parsed.protocol !== 'https:' || !parsed.hostname.endsWith('.supabase.co')) throw new Error('DB_URL_INVALID');

  // Accept accidental /rest/v1 or other path suffixes by using only the project origin.
  const url = parsed.origin;
  if (key.startsWith('sb_publishable_')) throw new Error('DB_KEY_WRONG_TYPE');
  return { url, key, hostname: parsed.hostname };
}

function classify(e: any) {
  const cause = e?.cause || {};
  const code = String(cause.code || e?.code || '').toUpperCase();
  const message = String(e?.message || '');
  const lower = message.toLowerCase();
  if (/^DB_\d{3}$/.test(message)) return [message, Number(message.slice(3)), message] as const;
  if (e?.name === 'AbortError') return ['DB_TIMEOUT', 504, 'Supabase não respondeu dentro do limite de 10 segundos.'] as const;
  if (code === 'ENOTFOUND') return ['DB_DNS_ENOTFOUND', 503, 'O hostname do Supabase não foi encontrado no DNS.'] as const;
  if (code === 'EAI_AGAIN') return ['DB_DNS_TEMPORARY', 503, 'A resolução DNS do Supabase falhou temporariamente.'] as const;
  if (code === 'ECONNREFUSED') return ['DB_CONNECTION_REFUSED', 503, 'A conexão com o Supabase foi recusada.'] as const;
  if (code === 'ECONNRESET') return ['DB_CONNECTION_RESET', 503, 'A conexão com o Supabase foi encerrada durante a tentativa.'] as const;
  if (code === 'ETIMEDOUT' || code === 'UND_ERR_CONNECT_TIMEOUT') return ['DB_CONNECT_TIMEOUT', 504, 'A conexão com o Supabase expirou antes de estabelecer comunicação.'] as const;
  if (code.includes('CERT') || lower.includes('certificate')) return ['DB_TLS_ERROR', 503, 'A validação TLS/HTTPS do Supabase falhou.'] as const;
  return ['DB_CONNECTION', 503, 'A Vercel não conseguiu estabelecer conexão HTTP com o Supabase.'] as const;
}

async function db<T>(resource: string, init: RequestInit = {}): Promise<T> {
  const { url, key } = dbConfig();
  for (let attempt = 1; attempt <= 2; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    try {
      const response = await fetch(`${url}/rest/v1/${resource}`, {
        ...init,
        signal: controller.signal,
        headers: {
          apikey: key,
          ...(key.startsWith('eyJ') ? { Authorization: `Bearer ${key}` } : {}),
          'Content-Type': 'application/json',
          ...(init.headers || {})
        }
      });
      const text = await response.text();
      if (!response.ok) {
        console.error('Supabase REST error', { status: response.status, body: text.slice(0, 500) });
        throw new Error(`DB_${response.status}`);
      }
      return text ? JSON.parse(text) as T : undefined as T;
    } catch (e: any) {
      const [code] = classify(e);
      if (code.startsWith('DB_') && /^DB_\d{3}$/.test(code)) throw e;
      if (attempt === 1 && (code === 'DB_CONNECTION' || code === 'DB_CONNECTION_REFUSED' || code === 'DB_CONNECTION_RESET' || code === 'DB_DNS_TEMPORARY')) {
        await new Promise(r => setTimeout(r, 250));
        continue;
      }
      throw Object.assign(new Error(code), { cause: e });
    } finally { clearTimeout(timer); }
  }
  throw new Error('DB_CONNECTION');
}

async function raw(req: Req) {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as any));
  return Buffer.concat(chunks);
}

async function body(req: Req) {
  const b = await raw(req);
  if (!b.length) return {} as Record<string, unknown>;
  try { return JSON.parse(b.toString('utf8')) as Record<string, unknown>; }
  catch { throw new Error('JSON_INVALID'); }
}

function validateAnswers(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Respostas inválidas.');
  const a = value as Record<string, unknown>;
  const keys = Object.keys(a);
  if (keys.length !== 12 || keys.some(k => !/^([1-9]|1[0-2])$/.test(k))) throw new Error('Respostas incompletas.');
  const out: Record<string, number> = {};
  for (let i = 1; i <= 12; i++) {
    const v = a[String(i)];
    if (!Number.isInteger(v) || Number(v) < 0 || Number(v) > 3) throw new Error('Resposta inválida.');
    out[String(i)] = Number(v);
  }
  return out;
}

function scores(a: Record<string, number>) {
  let medo = 0, inseguranca = 0, procrastinacao = 0;
  for (let i = 1; i <= 4; i++) medo += a[String(i)];
  for (let i = 5; i <= 8; i++) inseguranca += a[String(i)];
  for (let i = 9; i <= 12; i++) procrastinacao += a[String(i)];
  let resultado_dominante = 'MEDO';
  let max = medo;
  if (inseguranca > max) { resultado_dominante = 'INSEGURANÇA'; max = inseguranca; }
  if (procrastinacao > max) resultado_dominante = 'PROCRASTINAÇÃO';
  return { score_medo: medo, score_inseguranca: inseguranca, score_procrastinacao: procrastinacao, resultado_dominante };
}

async function findDuplicate(email: string, respostas: Record<string, number>) {
  const rows = await db<any[]>(`quiz_sessions?email=eq.${encodeURIComponent(email)}&select=quiz_session_id,email,respostas,payment_status,email_sent_at&limit=20`);
  return rows.find(row => {
    if (!row?.quiz_session_id || !validId(String(row.quiz_session_id))) return false;
    if (String(row.email || '').toLowerCase() !== email) return false;
    try { return JSON.stringify(row.respostas || {}) === JSON.stringify(respostas); } catch { return false; }
  }) || null;
}

export default async function handler(req: Req, res: Res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'Método não permitido.' });
  try {
    const b = await body(req);
    const nome = typeof b.nome === 'string' ? b.nome.trim().replace(/\s+/g, ' ') : '';
    const email = typeof b.email === 'string' ? b.email.trim().toLowerCase() : '';
    const respostas = validateAnswers(b.respostas);
    if (!nome || nome.length > 120) throw new Error('Nome inválido.');
    if (email.length > 254 || !/^\S+@\S+\.\S+$/.test(email)) throw new Error('Email inválido.');

    const duplicate = await findDuplicate(email, respostas);
    if (duplicate) return send(res, 200, { ok: true, quiz_session_id: duplicate.quiz_session_id, reused: true });

    const row = {
      quiz_session_id: randomUUID(),
      nome,
      email,
      respostas,
      ...scores(respostas),
      payment_status: 'pending'
    };
    await db('quiz_sessions', {
      method: 'POST',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify(row)
    });
    return send(res, 201, { ok: true, quiz_session_id: row.quiz_session_id });
  } catch (e: any) {
    const m = String(e?.message || '');
    const statusMap: Record<string, [number, string]> = {
      DB_CONFIG_URL_MISSING: [503, 'Supabase não configurado: SUPABASE_URL ausente.'],
      DB_CONFIG_KEY_MISSING: [503, 'Supabase não configurado: SUPABASE_SECRET_KEY ou SUPABASE_SERVICE_ROLE_KEY ausente ou inválida.'],
      DB_URL_INVALID: [503, 'SUPABASE_URL inválida. Use a URL do projeto no formato https://SEU-PROJETO.supabase.co.'],
      DB_KEY_WRONG_TYPE: [503, 'A chave configurada parece publishable/anon. O backend precisa de uma chave server-side.'],
      DB_TIMEOUT: [504, 'Supabase demorou para responder.'],
      DB_DNS_ENOTFOUND: [503, 'O hostname do Supabase não foi encontrado no DNS.'],
      DB_DNS_TEMPORARY: [503, 'A resolução DNS do Supabase falhou temporariamente.'],
      DB_CONNECTION_REFUSED: [503, 'A conexão com o Supabase foi recusada.'],
      DB_CONNECTION_RESET: [503, 'A conexão com o Supabase foi encerrada durante a tentativa.'],
      DB_CONNECT_TIMEOUT: [504, 'A conexão com o Supabase expirou antes de estabelecer comunicação.'],
      DB_TLS_ERROR: [503, 'A conexão HTTPS/TLS com o Supabase falhou.'],
      DB_CONNECTION: [503, 'Não foi possível conectar ao Supabase.'],
      DB_401: [503, 'Supabase recusou a chave. Confira SUPABASE_SECRET_KEY (recomendada) ou SUPABASE_SERVICE_ROLE_KEY e SUPABASE_URL.'],
      DB_403: [503, 'Supabase recusou a permissão da chave. Use uma chave server-side.'],
      DB_404: [503, 'A tabela quiz_sessions não foi encontrada no projeto Supabase informado.'],
      DB_400: [503, 'Supabase rejeitou os dados da sessão. Verifique o schema quiz_sessions.'],
      DB_409: [409, 'Não foi possível criar uma nova sessão. Tente novamente.']
    };
    const mapped = statusMap[m];
    if (mapped) return send(res, mapped[0], { error: mapped[1], code: m });
    if (m === 'JSON_INVALID' || m.startsWith('Nome ') || m.startsWith('Email ') || m.startsWith('Resposta')) return send(res, 400, { error: m });
    console.error('quiz POST failed', e);
    return send(res, 503, { error: 'Não foi possível salvar o diagnóstico.', code: m || 'DB_UNKNOWN' });
  }
}
