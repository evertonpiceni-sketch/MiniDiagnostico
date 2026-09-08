import { createHmac } from 'node:crypto';

type Req = { method?: string; query: Record<string, string | string[] | undefined> };
type Res = { status: (code: number) => Res; json: (data: unknown) => void };

const clean = (value?: string) => (value || '').trim().replace(/^["'](.*)["']$/, '$1').trim();
const RESULT_TOKEN_SECRET = clean(process.env.RESULT_TOKEN_SECRET);
const DB_URL = clean(process.env.SUPABASE_URL).replace(/\/$/, '');
const DB_KEY = [process.env.SUPABASE_SERVICE_ROLE_KEY, process.env.SUPABASE_SECRET_KEY]
  .map(clean)
  .find((key) => Boolean(key) && !key.startsWith('sb_publishable_')) || '';
const validId = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);

function resultToken(id: string) {
  if (RESULT_TOKEN_SECRET.length < 32) throw new Error('RESULT_TOKEN_SECRET_INVALID');
  return createHmac('sha256', RESULT_TOKEN_SECRET).update(`result:${id}`).digest('base64url');
}

async function getPaymentStatus(id: string) {
  if (!DB_URL || !DB_KEY) throw new Error('DB_CONFIG');
  const response = await fetch(`${DB_URL}/rest/v1/quiz_sessions?quiz_session_id=eq.${encodeURIComponent(id)}&select=payment_status&limit=1`, {
    headers: { apikey: DB_KEY, ...(DB_KEY.startsWith('eyJ') ? { Authorization: `Bearer ${DB_KEY}` } : {}), Accept: 'application/json' },
  });
  if (!response.ok) throw new Error(`DB_${response.status}`);
  const rows = await response.json() as Array<{ payment_status?: string }>;
  return rows[0]?.payment_status || null;
}

export default async function handler(req: Req, res: Res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido.' });
  const id = String(req.query.id || '');
  if (!validId(id)) return res.status(400).json({ error: 'Sessão inválida.' });
  try {
    const status = await getPaymentStatus(id);
    if (!status) return res.status(404).json({ error: 'Diagnóstico não encontrado.' });
    if (status !== 'paid') return res.status(402).json({ error: 'Pagamento ainda não confirmado.', payment_status: 'pending' });
    return res.status(200).json({ payment_status: 'paid', token: resultToken(id) });
  } catch (error) {
    console.error('Recover paid result access', error);
    return res.status(503).json({ error: 'Não foi possível recuperar o diagnóstico agora.' });
  }
}
