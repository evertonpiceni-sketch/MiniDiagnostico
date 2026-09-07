import { createHmac, timingSafeEqual } from 'node:crypto';

type Req = { method?: string; query: Record<string, string | string[] | undefined> };
type Res = { status: (code: number) => Res; json: (data: unknown) => void; setHeader?: (name: string, value: string) => void };
const clean = (v?: string) => (v || '').trim().replace(/^["'](.*)["']$/, '$1').trim();
const DB_URL = clean(process.env.SUPABASE_URL).replace(/\/$/, '');
const DB_KEY = [process.env.SUPABASE_SERVICE_ROLE_KEY, process.env.SUPABASE_SECRET_KEY].map(clean).find(k => Boolean(k) && !k.startsWith('sb_publishable_')) || '';
const SECRET = clean(process.env.RESULT_TOKEN_SECRET);
const validId = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
function validToken(id: string, token: string) {
  if (SECRET.length < 32 || !token) return false;
  const a = Buffer.from(createHmac('sha256', SECRET).update(`result:${id}`).digest('base64url'));
  const b = Buffer.from(token);
  return a.length === b.length && timingSafeEqual(a, b);
}
async function db(resource: string) {
  if (!DB_URL || !DB_KEY) throw new Error('DB_CONFIG');
  const r = await fetch(`${DB_URL}/rest/v1/${resource}`, { headers: { apikey: DB_KEY, ...(DB_KEY.startsWith('eyJ') ? { Authorization: `Bearer ${DB_KEY}` } : {}), Accept: 'application/json' } });
  if (!r.ok) throw new Error(`DB_${r.status}`);
  return await r.json();
}
export default async function handler(req: Req, res: Res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Método não permitido.' });
  const id = String(req.query.id || '');
  const token = String(req.query.token || '');
  if (!validId(id)) return res.status(400).json({ error: 'Sessão inválida.' });
  if (!validToken(id, token)) return res.status(403).json({ error: 'Acesso ao resultado não autorizado.' });
  try {
    const rows = await db(`quiz_sessions?quiz_session_id=eq.${encodeURIComponent(id)}&select=quiz_session_id,nome,score_medo,score_inseguranca,score_procrastinacao,resultado_dominante,payment_status,paid_at`);
    const q = rows?.[0];
    if (!q) return res.status(404).json({ error: 'Diagnóstico não encontrado.' });
    if (q.payment_status !== 'paid') return res.status(402).json({ error: 'Pagamento ainda não confirmado.', payment_status: 'pending' });
    res.setHeader?.('Cache-Control', 'private, no-store');
    return res.status(200).json({ quiz_session_id: q.quiz_session_id, nome: q.nome, score_medo: q.score_medo, score_inseguranca: q.score_inseguranca, score_procrastinacao: q.score_procrastinacao, resultado_dominante: q.resultado_dominante, payment_status: 'paid', paid_at: q.paid_at });
  } catch (e) {
    console.error('Paid result read error', e);
    return res.status(503).json({ error: 'Não foi possível carregar o resultado agora.' });
  }
}
