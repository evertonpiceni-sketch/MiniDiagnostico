type Req = NodeJS.ReadableStream & { method?: string; headers: Record<string, string | string[] | undefined> };
type Res = { status: (code: number) => Res; json: (data: unknown) => unknown };

function classify(error: any): { code: string; detail: string } {
  const cause = error?.cause || {};
  const code = String(cause?.code || '').toUpperCase();
  const name = String(error?.name || '');
  const message = String(error?.message || '').toLowerCase();
  if (name === 'AbortError') return { code: 'DB_TIMEOUT', detail: 'O endpoint do Supabase não respondeu dentro do limite.' };
  if (code === 'ENOTFOUND') return { code: 'DB_DNS_ENOTFOUND', detail: 'O hostname do SUPABASE_URL não foi encontrado no DNS.' };
  if (code === 'EAI_AGAIN') return { code: 'DB_DNS_TEMPORARY', detail: 'A resolução DNS do Supabase falhou temporariamente.' };
  if (code === 'ECONNREFUSED') return { code: 'DB_CONNECTION_REFUSED', detail: 'A conexão com o endpoint do Supabase foi recusada.' };
  if (code === 'ECONNRESET') return { code: 'DB_CONNECTION_RESET', detail: 'A conexão com o endpoint do Supabase foi encerrada durante a tentativa.' };
  if (message.includes('fetch failed')) return { code: 'DB_CONNECTION', detail: 'A Vercel não conseguiu estabelecer conexão HTTP com o Supabase.' };
  return { code: 'DB_CONNECTION', detail: 'Falha de conexão não classificada.' };
}

function configCheck() {
  const url = (process.env.SUPABASE_URL || '').trim().replace(/\/$/, '');
  const key = ((process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY) || '').trim();
  if (!url) return { ok: false, code: 'DB_CONFIG_URL_MISSING', detail: 'SUPABASE_URL não está configurada.' };
  if (!key || key.length < 20) return { ok: false, code: 'DB_CONFIG_KEY_MISSING', detail: 'SUPABASE_SECRET_KEY ou SUPABASE_SERVICE_ROLE_KEY não está configurada ou parece inválida.' };
  try {
    const u = new URL(url);
    if (u.protocol !== 'https:') return { ok: false, code: 'DB_URL_INVALID', detail: 'SUPABASE_URL precisa usar HTTPS.' };
    if (!u.hostname.endsWith('.supabase.co')) return { ok: false, code: 'DB_URL_INVALID', detail: 'SUPABASE_URL não aponta para um hostname supabase.co.' };
    return { ok: true, hostname: u.hostname };
  } catch {
    return { ok: false, code: 'DB_URL_INVALID', detail: 'SUPABASE_URL não é uma URL válida.' };
  }
}

export default async function handler(req: Req, res: Res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Método não permitido.' });
  const checkedAt = new Date().toISOString();
  const cfg = configCheck();
  if (!cfg.ok) return res.status(503).json({ status: 'error', checkedAt, ...cfg });

  const url = (process.env.SUPABASE_URL || '').trim().replace(/\/$/, '');
  const key = ((process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY) || '').trim();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(`${url}/rest/v1/quiz_sessions?select=quiz_session_id&limit=1`, {
      method: 'GET',
      signal: controller.signal,
      headers: { apikey: key, Authorization: `Bearer ${key}` }
    });
    const text = await response.text();
    if (!response.ok) {
      let detail = text.slice(0, 300);
      try { const parsed = JSON.parse(text); detail = String(parsed?.message || parsed?.hint || parsed?.error || detail); } catch {}
      const code = response.status === 401 ? 'DB_401' : response.status === 403 ? 'DB_403' : response.status === 404 ? 'DB_404' : response.status === 400 ? 'DB_400' : `DB_${response.status}`;
      return res.status(503).json({ status: 'error', checkedAt, hostname: (cfg as any).hostname, code, httpStatus: response.status, detail });
    }
    return res.status(200).json({ status: 'connected', checkedAt, hostname: (cfg as any).hostname, code: 'DB_OK', table: 'quiz_sessions', httpStatus: response.status });
  } catch (error: any) {
    const diagnosis = classify(error);
    return res.status(diagnosis.code === 'DB_TIMEOUT' ? 504 : 503).json({ status: 'error', checkedAt, hostname: (cfg as any).hostname, ...diagnosis });
  } finally {
    clearTimeout(timer);
  }
}
