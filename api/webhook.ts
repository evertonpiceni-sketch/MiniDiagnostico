import Stripe from 'stripe';
import { createHmac, timingSafeEqual } from 'node:crypto';

type Req = NodeJS.ReadableStream & {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
};
type Res = { status: (code: number) => Res; json: (data: unknown) => void };

export const config = { api: { bodyParser: false } };

const clean = (v?: string) => (v || '').trim().replace(/^["'](.*)["']$/, '$1').trim();
const STRIPE_KEY = clean(process.env.STRIPE_SECRET_KEY);
const WEBHOOK_SECRET = clean(process.env.STRIPE_WEBHOOK_SECRET);
const RESULT_TOKEN_SECRET = clean(process.env.RESULT_TOKEN_SECRET);
const DB_URL = clean(process.env.SUPABASE_URL).replace(/\/$/, '');
const DB_KEY = [process.env.SUPABASE_SERVICE_ROLE_KEY, process.env.SUPABASE_SECRET_KEY]
  .map(clean)
  .find((key) => Boolean(key) && !key.startsWith('sb_publishable_')) || '';

const validId = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);

async function raw(req: Req) {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as any));
  return Buffer.concat(chunks);
}

function validToken(id: string, token: unknown) {
  if (typeof token !== 'string' || !token || RESULT_TOKEN_SECRET.length < 32) return false;
  const expected = Buffer.from(createHmac('sha256', RESULT_TOKEN_SECRET).update(`result:${id}`).digest('base64url'));
  const received = Buffer.from(token);
  return expected.length === received.length && timingSafeEqual(expected, received);
}

async function patchPaid(id: string, session: Stripe.Checkout.Session) {
  if (!DB_URL || !DB_KEY) throw new Error('DB_CONFIG');
  const r = await fetch(`${DB_URL}/rest/v1/quiz_sessions?quiz_session_id=eq.${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: {
      apikey: DB_KEY,
      ...(DB_KEY.startsWith('eyJ') ? { Authorization: `Bearer ${DB_KEY}` } : {}),
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({
      payment_status: 'paid',
      paid_at: new Date().toISOString(),
      stripe_checkout_session_id: session.id,
    }),
  });
  if (!r.ok) throw new Error(`DB_${r.status}`);
}

export default async function handler(req: Req, res: Res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido.' });
  if (!STRIPE_KEY || !WEBHOOK_SECRET) return res.status(500).json({ error: 'Webhook Stripe não configurado.' });

  const signature = req.headers['stripe-signature'];
  if (typeof signature !== 'string') return res.status(400).json({ error: 'Assinatura Stripe ausente.' });

  try {
    const event = new Stripe(STRIPE_KEY).webhooks.constructEvent(await raw(req), signature, WEBHOOK_SECRET);

    if (event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') {
      const session = event.data.object as Stripe.Checkout.Session;
      const id = String(session.metadata?.quiz_session_id || session.client_reference_id || '');
      const token = session.metadata?.result_token;
      const validPayment = validId(id)
        && validToken(id, token)
        && session.payment_status === 'paid'
        && session.currency === 'brl'
        && session.amount_total === 990;

      if (!validPayment) throw new Error('PAYMENT_VALIDATION_FAILED');
      await patchPaid(id, session);
      // WhatsApp delivery is intentionally disabled for now.
    }

    return res.status(200).json({ received: true });
  } catch (e) {
    console.error('Stripe webhook processing', e);
    return res.status(400).json({ error: 'Webhook inválido ou não processado.' });
  }
}
