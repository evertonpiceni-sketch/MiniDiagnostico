type Req = { method?: string; body?: any; headers: Record<string, string | string[] | undefined> };
type Res = { status: (code: number) => Res; json: (data: unknown) => void };

const clean = (v?: string) => (v || '').trim().replace(/^["'](.*)["']$/, '$1').trim();
const WEBHOOK_TOKEN = clean(process.env.ASAAS_WEBHOOK_TOKEN);
const DB_URL = clean(process.env.SUPABASE_URL).replace(/\/$/, '');
const DB_KEY = [process.env.SUPABASE_SERVICE_ROLE_KEY, process.env.SUPABASE_SECRET_KEY]
  .map(clean)
  .find((key) => Boolean(key) && !key.startsWith('sb_publishable_')) || '';

function header(req: Req, name: string) {
  const value = req.headers[name] ?? req.headers[name.toLowerCase()];
  return Array.isArray(value) ? value[0] || '' : String(value || '');
}

async function markPaid(quizSessionId: string, asaasPaymentId: string) {
  if (!DB_URL || !DB_KEY) throw new Error('DB_CONFIG');
  const r = await fetch(`${DB_URL}/rest/v1/quiz_sessions?quiz_session_id=eq.${encodeURIComponent(quizSessionId)}&payment_status=neq.paid`, {
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
      asaas_payment_id: asaasPaymentId,
    }),
  });
  if (!r.ok) throw new Error(`DB_${r.status}`);
}

export default async function handler(req: Req, res: Res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido.' });
  if (!WEBHOOK_TOKEN) return res.status(503).json({ error: 'Webhook Asaas não configurado.' });

  const receivedToken = header(req, 'asaas-access-token');
  if (!receivedToken || receivedToken !== WEBHOOK_TOKEN) return res.status(401).json({ error: 'Webhook não autorizado.' });

  try {
    const event = String(req.body?.event || '');
    const payment = req.body?.payment || {};
    const paymentId = String(payment?.id || '').trim();
    const quizSessionId = String(payment?.externalReference || '').trim();

    // Only payment-confirmation events can unlock a diagnosis.
    if (!['PAYMENT_CONFIRMED', 'PAYMENT_RECEIVED'].includes(event)) {
      return res.status(200).json({ received: true, ignored: true });
    }
    if (!paymentId || !quizSessionId) return res.status(200).json({ received: true, ignored: true });

    await markPaid(quizSessionId, paymentId);
    return res.status(200).json({ received: true });
  } catch (e: any) {
    console.error('Asaas webhook error', e?.message || e);
    return res.status(500).json({ error: 'Falha ao processar webhook Asaas.' });
  }
}
