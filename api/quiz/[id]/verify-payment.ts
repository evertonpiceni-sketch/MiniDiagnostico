import { createHmac, timingSafeEqual } from 'node:crypto';
import { enforceRateLimit } from '../../_rate-limit.js';
type Req = { method?: string; body?: any; query: Record<string, string | string[] | undefined>; headers: Record<string, string | string[] | undefined> };
type Res = { status: (code: number) => Res; json: (data: unknown) => void; setHeader: (name: string, value: string) => void };
const clean = (v?: string) => (v || '').trim().replace(/^[\"'](.*)[\"']$/, '$1').trim();
const ASAAS_API_KEY = clean(process.env.ASAAS_API_KEY);
const ASAAS_API_URL = (clean(process.env.ASAAS_API_URL) || 'https://api.asaas.com/v3').replace(/\/$/, '');
const RESULT_TOKEN_SECRET = clean(process.env.RESULT_TOKEN_SECRET);
const DB_URL = clean(process.env.SUPABASE_URL).replace(/\/$/, '');
const DB_KEY = [process.env.SUPABASE_SERVICE_ROLE_KEY, process.env.SUPABASE_SECRET_KEY].map(clean).find((key) => Boolean(key) && !key.startsWith('sb_publishable_')) || '';
const validId = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
function expectedToken(id: string) { if (RESULT_TOKEN_SECRET.length < 32) return ''; return createHmac('sha256', RESULT_TOKEN_SECRET).update(`result:${id}`).digest('base64url'); }
function validToken(id: string, token: unknown) { if (typeof token !== 'string' || !token) return false; const expected = Buffer.from(expectedToken(id)); const received = Buffer.from(token); return expected.length > 0 && expected.length === received.length && timingSafeEqual(expected, received); }
async function db(resource: string, init: RequestInit = {}) { if (!DB_URL || !DB_KEY) throw new Error('DB_CONFIG'); const r = await fetch(`${DB_URL}/rest/v1/${resource}`, { ...init, headers: { apikey: DB_KEY, ...(DB_KEY.startsWith('eyJ') ? { Authorization: `Bearer ${DB_KEY}` } : {}), 'Content-Type': 'application/json', ...(init.headers || {}) } }); const text = await r.text(); if (!r.ok) throw new Error(`DB_${r.status}`); return text ? JSON.parse(text) : null; }
async function markPaid(id: string, method: 'pix_asaas' | 'card_asaas') { await db(`quiz_sessions?quiz_session_id=eq.${encodeURIComponent(id)}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ payment_status: 'paid', paid_at: new Date().toISOString(), payment_method_selected: method, checkout_error_code: null, checkout_error_message: null, checkout_error_at: null }) }); }
async function verifyAsaas(id: string, paymentId: string) {
  if (!ASAAS_API_KEY || !paymentId) return false;
  const r = await fetch(`${ASAAS_API_URL}/payments/${encodeURIComponent(paymentId)}`, { headers: { access_token: ASAAS_API_KEY, 'User-Agent': 'MiniDiagnostico/1.0', Accept: 'application/json' } });
  if (!r.ok) return false;
  const payment = await r.json() as any;
  const billingType = String(payment?.billingType || '');
  const validPayment = String(payment?.externalReference || '') === id && ['PIX', 'CREDIT_CARD'].includes(billingType) && Math.abs(Number(payment?.value) - 9.9) <= 0.001 && ['RECEIVED', 'CONFIRMED'].includes(String(payment?.status || ''));
  if (!validPayment) return false;
  await markPaid(id, billingType === 'PIX' ? 'pix_asaas' : 'card_asaas');
  return true;
}
export default async function handler(req: Req, res: Res) {
  res.setHeader('Cache-Control', 'private, no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido.' });
  if (!enforceRateLimit(req, res, 'verify-payment', 30, 5 * 60_000)) return;
  const id = String(req.query.id || '');
  if (!validId(id)) return res.status(400).json({ error: 'Sessão inválida.' });
  const token = String(req.body?.token || '');
  if (!validToken(id, token)) return res.status(403).json({ error: 'Acesso ao resultado não autorizado.' });
  try {
    const rows = await db(`quiz_sessions?quiz_session_id=eq.${encodeURIComponent(id)}&select=quiz_session_id,payment_status,asaas_payment_id,payment_method_selected`) as any[];
    const quiz = rows?.[0];
    if (!quiz) return res.status(404).json({ error: 'Quiz não encontrado.' });
    if (quiz.payment_status === 'paid') return res.status(200).json({ payment_status: 'paid' });
    if (quiz.asaas_payment_id && await verifyAsaas(id, String(quiz.asaas_payment_id))) return res.status(200).json({ payment_status: 'paid' });
    return res.status(200).json({ payment_status: 'pending' });
  } catch (e) { console.error('Verify Asaas payment', e); return res.status(503).json({ error: 'Não foi possível verificar o pagamento.', payment_status: 'pending' }); }
}
