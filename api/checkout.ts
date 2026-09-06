import Stripe from 'stripe';
import { createHash, createHmac } from 'node:crypto';

type Req = { method?: string; body?: any; headers: Record<string, string | string[] | undefined> };
type Res = { status: (code: number) => Res; json: (data: unknown) => void };

const clean = (v?: string) => (v || '').trim().replace(/^["'](.*)["']$/, '$1').trim();
const STRIPE_KEY = clean(process.env.STRIPE_SECRET_KEY);
const STRIPE_PRICE_ID = clean(process.env.STRIPE_PRICE_ID);
const RESULT_TOKEN_SECRET = clean(process.env.RESULT_TOKEN_SECRET);
const APP_URL = clean(process.env.APP_URL).replace(/\/$/, '');
const DB_URL = clean(process.env.SUPABASE_URL).replace(/\/$/, '');
const DB_KEY = [process.env.SUPABASE_SERVICE_ROLE_KEY, process.env.SUPABASE_SECRET_KEY]
  .map(clean)
  .find((key) => Boolean(key) && !key.startsWith('sb_publishable_')) || '';
const validId = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
const validLiveStripeKey = (key: string) => key.startsWith('sk_live_') || key.startsWith('rk_live_');

function resultToken(id: string) {
  if (RESULT_TOKEN_SECRET.length < 32) throw new Error('RESULT_TOKEN_SECRET_INVALID');
  return createHmac('sha256', RESULT_TOKEN_SECRET).update(`result:${id}`).digest('base64url');
}

function appUrl(req: Req) {
  if (APP_URL) return APP_URL;
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0].trim();
  return `https://${host}`;
}

async function patchQuiz(id: string, body: Record<string, unknown>) {
  if (!DB_URL || !DB_KEY) throw new Error('DB_CONFIG');
  const r = await fetch(`${DB_URL}/rest/v1/quiz_sessions?quiz_session_id=eq.${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: {
      apikey: DB_KEY,
      ...(DB_KEY.startsWith('eyJ') ? { Authorization: `Bearer ${DB_KEY}` } : {}),
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`DB_${r.status}`);
}

async function findQuiz(id: string) {
  if (!DB_URL || !DB_KEY) throw new Error('DB_CONFIG');
  const r = await fetch(`${DB_URL}/rest/v1/quiz_sessions?quiz_session_id=eq.${encodeURIComponent(id)}&select=quiz_session_id,nome,payment_status`, {
    headers: {
      apikey: DB_KEY,
      ...(DB_KEY.startsWith('eyJ') ? { Authorization: `Bearer ${DB_KEY}` } : {}),
      Accept: 'application/json',
    },
  });
  if (!r.ok) throw new Error(`DB_${r.status}`);
  const rows = await r.json() as any[];
  return rows[0] || null;
}

async function markCheckoutAttempt(id: string) {
  await patchQuiz(id, {
    payment_method_selected: 'card',
    checkout_attempted_at: new Date().toISOString(),
    checkout_error_code: null,
    checkout_error_message: null,
    checkout_error_at: null,
  });
}

async function markCheckoutError(id: string, code: string, message: string) {
  try {
    await patchQuiz(id, {
      checkout_error_code: code.slice(0, 120),
      checkout_error_message: message.slice(0, 500),
      checkout_error_at: new Date().toISOString(),
    });
  } catch (dbError) {
    console.error('Checkout error persistence failed', dbError);
  }
}

async function markCheckoutSession(id: string, stripeSessionId: string, token: string) {
  await patchQuiz(id, {
    stripe_checkout_session_id: stripeSessionId,
    result_access_token_hash: createHash('sha256').update(token).digest('hex'),
    checkout_error_code: null,
    checkout_error_message: null,
    checkout_error_at: null,
  });
}

export default async function handler(req: Req, res: Res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido.' });

  const id = String(req.body?.quiz_session_id || '').trim();
  if (!validId(id)) return res.status(400).json({ error: 'Sessão do diagnóstico inválida.' });

  try {
    const quiz = await findQuiz(id);
    if (!quiz) return res.status(404).json({ error: 'Diagnóstico não encontrado.' });
    if (quiz.payment_status === 'paid') return res.status(409).json({ error: 'Este diagnóstico já foi pago.' });

    try {
      await markCheckoutAttempt(id);
    } catch (dbError) {
      console.error('Checkout attempt persistence error', dbError);
      return res.status(503).json({ error: 'Não foi possível registrar a tentativa de pagamento. Tente novamente.' });
    }

    if (!validLiveStripeKey(STRIPE_KEY)) {
      await markCheckoutError(id, 'STRIPE_CONFIG', 'Stripe de produção não está configurado corretamente.');
      return res.status(503).json({ error: 'Stripe de produção não está configurado corretamente.' });
    }
    if (!STRIPE_PRICE_ID.startsWith('price_')) {
      await markCheckoutError(id, 'STRIPE_PRICE_CONFIG', 'O preço da Stripe não está configurado.');
      return res.status(503).json({ error: 'O preço da Stripe não está configurado.' });
    }
    if (RESULT_TOKEN_SECRET.length < 32) {
      await markCheckoutError(id, 'RESULT_TOKEN_CONFIG', 'Proteção do resultado não está configurada.');
      return res.status(503).json({ error: 'Proteção do resultado não está configurada.' });
    }

    const stripe = new Stripe(STRIPE_KEY);
    const base = appUrl(req);
    const token = resultToken(id);
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [{ price: STRIPE_PRICE_ID, quantity: 1 }],
      client_reference_id: id,
      metadata: { quiz_session_id: id, result_token: token },
      success_url: `${base}/resultado?session_id=${encodeURIComponent(id)}&token=${encodeURIComponent(token)}&checkout_session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${base}/paywall?session_id=${encodeURIComponent(id)}&canceled=true`,
    }, { idempotencyKey: `mini-diagnostico-checkout:${id}` });

    if (!session.url) {
      await markCheckoutError(id, 'STRIPE_NO_URL', 'Stripe não retornou o endereço do pagamento.');
      return res.status(502).json({ error: 'Stripe não retornou o endereço do pagamento.' });
    }

    try {
      await markCheckoutSession(id, session.id, token);
    } catch (dbError) {
      console.error('Checkout session persistence error', dbError);
      await markCheckoutError(id, 'CHECKOUT_PERSISTENCE', 'Não foi possível registrar a sessão de pagamento.');
      return res.status(503).json({ error: 'Não foi possível registrar a sessão de pagamento. Tente novamente.' });
    }

    return res.status(200).json({ ok: true, url: session.url });
  } catch (e: any) {
    const message = String(e?.message || e || 'Erro desconhecido');
    const code = typeof e?.code === 'string' ? e.code : 'CHECKOUT_ERROR';
    console.error('Stripe checkout error', message);
    await markCheckoutError(id, code, message);
    return res.status(500).json({ error: 'Não foi possível iniciar o pagamento.' });
  }
}
