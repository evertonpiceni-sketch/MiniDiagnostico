import Stripe from 'stripe';
import { createHmac, timingSafeEqual } from 'node:crypto';

type Req = {
  method?: string;
  body?: any;
  query: Record<string, string | string[] | undefined>;
};
type Res = { status: (code: number) => Res; json: (data: unknown) => void };

const clean = (v?: string) => (v || '').trim().replace(/^["'](.*)["']$/, '$1').trim();
const STRIPE_KEY = clean(process.env.STRIPE_SECRET_KEY);
const RESULT_TOKEN_SECRET = clean(process.env.RESULT_TOKEN_SECRET);
const DB_URL = clean(process.env.SUPABASE_URL).replace(/\/$/, '');
const DB_KEY = [process.env.SUPABASE_SERVICE_ROLE_KEY, process.env.SUPABASE_SECRET_KEY]
  .map(clean)
  .find((key) => Boolean(key) && !key.startsWith('sb_publishable_')) || '';

const validId = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);

function expectedToken(id: string) {
  if (RESULT_TOKEN_SECRET.length < 32) return '';
  return createHmac('sha256', RESULT_TOKEN_SECRET).update(`result:${id}`).digest('base64url');
}

function validToken(id: string, token: unknown) {
  if (typeof token !== 'string' || !token) return false;
  const expected = Buffer.from(expectedToken(id));
  const received = Buffer.from(token);
  return expected.length > 0 && expected.length === received.length && timingSafeEqual(expected, received);
}

async function db(resource: string, init: RequestInit = {}) {
  if (!DB_URL || !DB_KEY) throw new Error('DB_CONFIG');
  const r = await fetch(`${DB_URL}/rest/v1/${resource}`, {
    ...init,
    headers: {
      apikey: DB_KEY,
      ...(DB_KEY.startsWith('eyJ') ? { Authorization: `Bearer ${DB_KEY}` } : {}),
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`DB_${r.status}`);
  return text ? JSON.parse(text) : null;
}

export default async function handler(req: Req, res: Res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido.' });

  const id = String(req.query.id || '');
  if (!validId(id)) return res.status(400).json({ error: 'Sessão inválida.' });
  const token = String(req.body?.token || '');
  if (!validToken(id, token)) return res.status(403).json({ error: 'Acesso ao resultado não autorizado.' });

  try {
    const rows = await db(`quiz_sessions?quiz_session_id=eq.${encodeURIComponent(id)}&select=quiz_session_id,payment_status,stripe_checkout_session_id`) as any[];
    const quiz = rows?.[0];
    if (!quiz) return res.status(404).json({ error: 'Quiz não encontrado.' });
    if (quiz.payment_status === 'paid') return res.status(200).json({ payment_status: 'paid' });

    const supplied = String(req.body?.checkout_session_id || '');
    const checkoutId = supplied.startsWith('cs_') ? supplied : String(quiz.stripe_checkout_session_id || '');
    if (!checkoutId.startsWith('cs_') || !STRIPE_KEY) return res.status(200).json({ payment_status: 'pending' });
    if (quiz.stripe_checkout_session_id && quiz.stripe_checkout_session_id !== checkoutId) {
      return res.status(403).json({ error: 'Checkout não pertence a esta sessão.' });
    }

    const session = await new Stripe(STRIPE_KEY).checkout.sessions.retrieve(checkoutId);
    const linkedQuizId = session.metadata?.quiz_session_id || session.client_reference_id;
    const validPayment = linkedQuizId === id
      && session.metadata?.result_token === token
      && session.payment_status === 'paid'
      && session.currency === 'brl'
      && session.amount_total === 990;

    if (!validPayment) return res.status(200).json({ payment_status: 'pending' });

    await db(`quiz_sessions?quiz_session_id=eq.${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({
        payment_status: 'paid',
        paid_at: new Date().toISOString(),
        stripe_checkout_session_id: session.id,
      }),
    });

    // WhatsApp delivery is intentionally not triggered here. The paid result is
    // unlocked directly in the web app/PDF flow.
    return res.status(200).json({ payment_status: 'paid' });
  } catch (e) {
    console.error('Verify payment', e);
    return res.status(503).json({ error: 'Não foi possível verificar o pagamento.', payment_status: 'pending' });
  }
}
