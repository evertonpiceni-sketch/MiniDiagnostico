type Req = { method?: string; body?: any; headers: Record<string, string | string[] | undefined> };
type Res = { status: (code: number) => Res; json: (data: unknown) => void };
const clean = (v?: string) => (v || '').trim().replace(/^["'](.*)["']$/, '$1').trim();
const WEBHOOK_TOKEN = clean(process.env.ASAAS_WEBHOOK_TOKEN);
const DB_URL = clean(process.env.SUPABASE_URL).replace(/\/$/, '');
const DB_KEY = [process.env.SUPABASE_SERVICE_ROLE_KEY, process.env.SUPABASE_SECRET_KEY].map(clean).find((key) => Boolean(key) && !key.startsWith('sb_publishable_')) || '';
const validId = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
function header(req: Req, name: string) { const value = req.headers[name] ?? req.headers[name.toLowerCase()]; return Array.isArray(value) ? value[0] || '' : String(value || ''); }
async function markPaid(quizSessionId: string, asaasPaymentId: string, method: 'pix_asaas' | 'card_asaas') {
  if (!DB_URL || !DB_KEY) throw new Error('DB_CONFIG');
  const filters = `quiz_session_id=eq.${encodeURIComponent(quizSessionId)}&asaas_payment_id=eq.${encodeURIComponent(asaasPaymentId)}&payment_status=neq.paid`;
  const r = await fetch(`${DB_URL}/rest/v1/quiz_sessions?${filters}`, { method: 'PATCH', headers: { apikey: DB_KEY, ...(DB_KEY.startsWith('eyJ') ? { Authorization: `Bearer ${DB_KEY}` } : {}), 'Content-Type': 'application/json', Prefer: 'return=representation' }, body: JSON.stringify({ payment_status: 'paid', paid_at: new Date().toISOString(), payment_method_selected: method, checkout_error_code: null, checkout_error_message: null, checkout_error_at: null, whatsapp_delivery_status: 'pending' }) });
  const text = await r.text(); if (!r.ok) throw new Error(`DB_${r.status}`); const rows = text ? JSON.parse(text) as any[] : []; return rows.length > 0;
}
export default async function handler(req: Req, res: Res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido.' });
  if (!WEBHOOK_TOKEN) return res.status(503).json({ error: 'Webhook Asaas não configurado.' });
  if (header(req, 'asaas-access-token') !== WEBHOOK_TOKEN) return res.status(401).json({ error: 'Webhook não autorizado.' });
  try {
    const event = String(req.body?.event || '');
    if (!['PAYMENT_CONFIRMED', 'PAYMENT_RECEIVED'].includes(event)) return res.status(200).json({ received: true, ignored: true });
    const payment = req.body?.payment || {};
    const paymentId = String(payment?.id || '').trim();
    const quizSessionId = String(payment?.externalReference || '').trim();
    const value = Number(payment?.value);
    const billingType = String(payment?.billingType || '');
    const status = String(payment?.status || '');
    if (!paymentId || !validId(quizSessionId) || Math.abs(value - 9.9) > 0.001) return res.status(200).json({ received: true, ignored: true });
    if (!['PIX', 'CREDIT_CARD'].includes(billingType)) return res.status(200).json({ received: true, ignored: true });
    if (!['CONFIRMED', 'RECEIVED'].includes(status)) return res.status(200).json({ received: true, ignored: true });
    const updated = await markPaid(quizSessionId, paymentId, billingType === 'PIX' ? 'pix_asaas' : 'card_asaas');
    return res.status(200).json({ received: true, updated });
  } catch (e: any) { console.error('Asaas webhook error', e?.message || e); return res.status(500).json({ error: 'Falha ao processar webhook Asaas.' }); }
}
