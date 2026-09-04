import Stripe from 'stripe';

type Req = { method?: string; body?: any; headers: Record<string, string | string[] | undefined> };
type Res = { status: (code: number) => Res; json: (data: unknown) => void };

const clean = (v?: string) => (v || '').trim().replace(/^["'](.*)["']$/, '$1').trim();
const STRIPE_KEY = clean(process.env.STRIPE_SECRET_KEY);
const PRICE_ID = clean(process.env.STRIPE_PRICE_ID);
const APP_URL = clean(process.env.APP_URL).replace(/\/$/, '');
const DB_URL = clean(process.env.SUPABASE_URL).replace(/\/$/, '');
// Prefer the server-side service-role key. Ignore an accidental publishable key
// in SUPABASE_SECRET_KEY instead of letting it override the valid server key.
const DB_KEY = [process.env.SUPABASE_SERVICE_ROLE_KEY, process.env.SUPABASE_SECRET_KEY]
  .map(clean)
  .find((key) => Boolean(key) && !key.startsWith('sb_publishable_')) || '';
const validId = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);

function appUrl(req: Req) {
  if (APP_URL) return APP_URL;
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0].trim();
  return `https://${host}`;
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

async function markCheckoutSession(id: string, stripeSessionId: string) {
  if (!DB_URL || !DB_KEY) throw new Error('DB_CONFIG');
  const r = await fetch(`${DB_URL}/rest/v1/quiz_sessions?quiz_session_id=eq.${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: {
      apikey: DB_KEY,
      ...(DB_KEY.startsWith('eyJ') ? { Authorization: `Bearer ${DB_KEY}` } : {}),
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({ stripe_checkout_session_id: stripeSessionId }),
  });
  if (!r.ok) throw new Error(`DB_${r.status}`);
}

export default async function handler(req: Req, res: Res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido.' });
  try {
    if (!STRIPE_KEY || !PRICE_ID) return res.status(503).json({ error: 'Stripe não está configurado.' });
    const id = String(req.body?.quiz_session_id || '').trim();
    if (!validId(id)) return res.status(400).json({ error: 'Sessão do diagnóstico inválida.' });
    const quiz = await findQuiz(id);
    if (!quiz) return res.status(404).json({ error: 'Diagnóstico não encontrado.' });
    if (quiz.payment_status === 'paid') return res.status(409).json({ error: 'Este diagnóstico já foi pago.' });

    const stripe = new Stripe(STRIPE_KEY);
    const base = appUrl(req);
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [{ price: PRICE_ID, quantity: 1 }],
      client_reference_id: id,
      metadata: { quiz_session_id: id },
      success_url: `${base}/api/diagnostico-pdf?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${base}/paywall?session_id=${encodeURIComponent(id)}&canceled=true`,
    });
    if (!session.url) return res.status(502).json({ error: 'Stripe não retornou o endereço do pagamento.' });

    try {
      await markCheckoutSession(id, session.id);
    } catch (dbError) {
      console.error('Checkout session persistence error', dbError);
      return res.status(503).json({ error: 'Não foi possível registrar a sessão de pagamento. Tente novamente.' });
    }

    return res.status(200).json({ ok: true, url: session.url });
  } catch (e: any) {
    console.error('Stripe checkout error', e?.message || e);
    return res.status(500).json({ error: 'Não foi possível iniciar o pagamento.' });
  }
}
