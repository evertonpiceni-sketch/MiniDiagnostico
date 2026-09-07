import { createHash, createHmac } from 'node:crypto';

type Req = { method?: string; body?: any; headers: Record<string, string | string[] | undefined> };
type Res = { status: (code: number) => Res; json: (data: unknown) => void };

const clean = (v?: string) => (v || '').trim().replace(/^["'](.*)["']$/, '$1').trim();
const ASAAS_API_KEY = clean(process.env.ASAAS_API_KEY);
const ASAAS_API_URL = (clean(process.env.ASAAS_API_URL) || 'https://api.asaas.com/v3').replace(/\/$/, '');
const RESULT_TOKEN_SECRET = clean(process.env.RESULT_TOKEN_SECRET);
const APP_URL = clean(process.env.APP_URL).replace(/\/$/, '');
const DB_URL = clean(process.env.SUPABASE_URL).replace(/\/$/, '');
const DB_KEY = [process.env.SUPABASE_SERVICE_ROLE_KEY, process.env.SUPABASE_SECRET_KEY]
  .map(clean).find((key) => Boolean(key) && !key.startsWith('sb_publishable_')) || '';
const validId = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);

function resultToken(id: string) {
  if (RESULT_TOKEN_SECRET.length < 32) throw new Error('RESULT_TOKEN_SECRET_INVALID');
  return createHmac('sha256', RESULT_TOKEN_SECRET).update(`result:${id}`).digest('base64url');
}
function appUrl(req: Req) {
  if (APP_URL) return APP_URL;
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0].trim();
  if (!host) throw new Error('APP_URL_INVALID');
  return `https://${host}`;
}
async function db<T>(resource: string, init: RequestInit = {}): Promise<T> {
  if (!DB_URL || !DB_KEY) throw new Error('DB_CONFIG');
  const r = await fetch(`${DB_URL}/rest/v1/${resource}`, { ...init, headers: { apikey: DB_KEY, ...(DB_KEY.startsWith('eyJ') ? { Authorization: `Bearer ${DB_KEY}` } : {}), 'Content-Type': 'application/json', ...(init.headers || {}) } });
  const text = await r.text();
  if (!r.ok) throw new Error(`DB_${r.status}`);
  return text ? JSON.parse(text) as T : undefined as T;
}
async function patchQuiz(id: string, body: Record<string, unknown>) {
  await db(`quiz_sessions?quiz_session_id=eq.${encodeURIComponent(id)}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(body) });
}
async function asaas<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!ASAAS_API_KEY) throw new Error('ASAAS_NOT_CONFIGURED');
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 15000);
  try {
    const r = await fetch(`${ASAAS_API_URL}${path}`, { ...init, signal: ctl.signal, headers: { access_token: ASAAS_API_KEY, 'User-Agent': 'MiniDiagnostico/1.0', 'Content-Type': 'application/json', Accept: 'application/json', ...(init.headers || {}) } });
    const text = await r.text();
    let data: any = {}; try { data = text ? JSON.parse(text) : {}; } catch {}
    if (!r.ok) throw new Error(`ASAAS_${r.status}:${String(data?.errors?.[0]?.description || data?.message || 'Falha na API').slice(0, 250)}`);
    return data as T;
  } finally { clearTimeout(timer); }
}
function todayBrazil() {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const map = Object.fromEntries(parts.map(p => [p.type, p.value]));
  return `${map.year}-${map.month}-${map.day}`;
}
async function findOrCreateCustomer(quiz: any) {
  const found = await asaas<any>(`/customers?externalReference=${encodeURIComponent(quiz.quiz_session_id)}&limit=1`);
  const existing = Array.isArray(found?.data) ? found.data[0] : null;
  if (existing?.id) return String(existing.id);
  const mobilePhone = String(quiz.whatsapp || '').replace(/\D/g, '').replace(/^55/, '');
  const created = await asaas<any>('/customers', { method: 'POST', body: JSON.stringify({ name: String(quiz.nome || 'Cliente Mini Diagnóstico').slice(0, 100), mobilePhone: mobilePhone || undefined, externalReference: quiz.quiz_session_id, notificationDisabled: true }) });
  if (!created?.id) throw new Error('ASAAS_CUSTOMER_ID_MISSING');
  return String(created.id);
}

export default async function handler(req: Req, res: Res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido.' });
  const id = String(req.body?.quiz_session_id || '').trim();
  if (!validId(id)) return res.status(400).json({ error: 'Sessão do diagnóstico inválida.' });
  try {
    if (!ASAAS_API_KEY) throw new Error('ASAAS_NOT_CONFIGURED');
    const rows = await db<any[]>(`quiz_sessions?quiz_session_id=eq.${encodeURIComponent(id)}&select=quiz_session_id,nome,whatsapp,payment_status,asaas_payment_id,payment_method_selected`);
    const quiz = rows?.[0];
    if (!quiz) return res.status(404).json({ error: 'Diagnóstico não encontrado.' });
    if (quiz.payment_status === 'paid') return res.status(409).json({ error: 'Este diagnóstico já foi pago.' });

    const token = resultToken(id);
    const customerId = await findOrCreateCustomer(quiz);
    const base = appUrl(req);
    const successUrl = `${base}/resultado?session_id=${encodeURIComponent(id)}&token=${encodeURIComponent(token)}`;
    const payment = await asaas<any>('/payments', { method: 'POST', body: JSON.stringify({ customer: customerId, billingType: 'CREDIT_CARD', value: 9.90, dueDate: todayBrazil(), description: 'Mini Diagnóstico Completo', externalReference: id, callback: { successUrl, autoRedirect: true } }) });
    if (!payment?.id || !payment?.invoiceUrl) throw new Error('ASAAS_PAYMENT_RESPONSE_INVALID');

    await patchQuiz(id, { payment_method_selected: 'card_asaas', asaas_payment_id: String(payment.id), result_access_token_hash: createHash('sha256').update(token).digest('hex'), checkout_attempted_at: new Date().toISOString(), checkout_error_code: null, checkout_error_message: null, checkout_error_at: null });
    return res.status(200).json({ ok: true, url: String(payment.invoiceUrl), token });
  } catch (e: any) {
    const message = String(e?.message || e || 'Erro desconhecido');
    console.error('Asaas card checkout error', message);
    try { await patchQuiz(id, { payment_method_selected: 'card_asaas', checkout_error_code: message.split(':')[0].slice(0, 120), checkout_error_message: message.slice(0, 500), checkout_error_at: new Date().toISOString() }); } catch {}
    if (message === 'ASAAS_NOT_CONFIGURED') return res.status(503).json({ error: 'Asaas não está configurado para cartão.' });
    if (message === 'RESULT_TOKEN_SECRET_INVALID') return res.status(503).json({ error: 'Proteção do resultado não está configurada.' });
    if (message === 'DB_CONFIG' || message.startsWith('DB_')) return res.status(503).json({ error: 'Banco de dados indisponível.' });
    if (message.startsWith('ASAAS_400:') || message.startsWith('ASAAS_422:')) return res.status(400).json({ error: 'O Asaas recusou a criação da cobrança de cartão.' });
    return res.status(502).json({ error: 'Não foi possível iniciar o pagamento com cartão no Asaas.' });
  }
}
