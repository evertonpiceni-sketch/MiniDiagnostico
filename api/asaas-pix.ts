import { createHash, createHmac } from 'node:crypto';

type Req = { method?: string; body?: any; headers: Record<string, string | string[] | undefined> };
type Res = { status: (code: number) => Res; json: (data: unknown) => void };

const clean = (v?: string) => (v || '').trim().replace(/^["'](.*)["']$/, '$1').trim();
const ASAAS_API_KEY = clean(process.env.ASAAS_API_KEY);
const ASAAS_API_URL = (clean(process.env.ASAAS_API_URL) || 'https://api.asaas.com/v3').replace(/\/$/, '');
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

async function db<T>(resource: string, init: RequestInit = {}): Promise<T> {
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
  if (!r.ok) throw new Error(`DB_${r.status}:${text.slice(0, 300)}`);
  return text ? JSON.parse(text) as T : undefined as T;
}

async function asaas<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!ASAAS_API_KEY) throw new Error('ASAAS_NOT_CONFIGURED');
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 12000);
  try {
    const r = await fetch(`${ASAAS_API_URL}${path}`, {
      ...init,
      signal: ctl.signal,
      headers: {
        access_token: ASAAS_API_KEY,
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(init.headers || {}),
      },
    });
    const text = await r.text();
    const data = text ? JSON.parse(text) : {};
    if (!r.ok) {
      const detail = Array.isArray(data?.errors) ? data.errors.map((e: any) => e?.description).filter(Boolean).join(' | ') : '';
      throw new Error(`ASAAS_${r.status}:${detail || text.slice(0, 300)}`);
    }
    return data as T;
  } finally {
    clearTimeout(timer);
  }
}

function todayBrazil() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

async function findOrCreateCustomer(quiz: any) {
  const found = await asaas<any>(`/customers?externalReference=${encodeURIComponent(quiz.quiz_session_id)}&limit=1`);
  const existing = Array.isArray(found?.data) ? found.data[0] : null;
  if (existing?.id) return String(existing.id);

  const mobilePhone = String(quiz.whatsapp || '').replace(/\D/g, '').replace(/^55/, '');
  const created = await asaas<any>('/customers', {
    method: 'POST',
    body: JSON.stringify({
      name: String(quiz.nome || 'Cliente Mini Diagnóstico').slice(0, 100),
      mobilePhone: mobilePhone || undefined,
      externalReference: quiz.quiz_session_id,
      notificationDisabled: true,
    }),
  });
  if (!created?.id) throw new Error('ASAAS_CUSTOMER_ID_MISSING');
  return String(created.id);
}

async function createPayment(quiz: any, customerId: string) {
  const payment = await asaas<any>('/payments', {
    method: 'POST',
    body: JSON.stringify({
      customer: customerId,
      billingType: 'PIX',
      value: 9.90,
      dueDate: todayBrazil(),
      description: 'Mini Diagnóstico Completo',
      externalReference: quiz.quiz_session_id,
    }),
  });
  if (!payment?.id) throw new Error('ASAAS_PAYMENT_ID_MISSING');
  return payment;
}

async function savePayment(quizId: string, paymentId: string, token: string) {
  await db(`quiz_sessions?quiz_session_id=eq.${encodeURIComponent(quizId)}&payment_status=neq.paid`, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({
      asaas_payment_id: paymentId,
      result_access_token_hash: createHash('sha256').update(token).digest('hex'),
    }),
  });
}

export default async function handler(req: Req, res: Res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido.' });

  try {
    if (!ASAAS_API_KEY) return res.status(503).json({ error: 'PIX Asaas não está configurado.' });
    if (RESULT_TOKEN_SECRET.length < 32) return res.status(503).json({ error: 'Proteção do resultado não está configurada.' });

    const id = String(req.body?.quiz_session_id || '').trim();
    if (!validId(id)) return res.status(400).json({ error: 'Sessão do diagnóstico inválida.' });

    const rows = await db<any[]>(`quiz_sessions?quiz_session_id=eq.${encodeURIComponent(id)}&select=quiz_session_id,nome,whatsapp,payment_status,asaas_payment_id`);
    const quiz = rows[0];
    if (!quiz) return res.status(404).json({ error: 'Diagnóstico não encontrado.' });

    const token = resultToken(id);
    if (quiz.payment_status === 'paid') {
      return res.status(200).json({ ok: true, paid: true, token });
    }

    let payment: any = null;
    if (quiz.asaas_payment_id) {
      try {
        payment = await asaas<any>(`/payments/${encodeURIComponent(String(quiz.asaas_payment_id))}`);
        if (String(payment?.externalReference || '') !== id || Number(payment?.value) !== 9.9 || String(payment?.billingType || '') !== 'PIX') {
          throw new Error('ASAAS_PAYMENT_MISMATCH');
        }
      } catch (error: any) {
        if (String(error?.message || '').startsWith('ASAAS_404:')) payment = null;
        else throw error;
      }
    }

    if (!payment) {
      const customerId = await findOrCreateCustomer(quiz);
      payment = await createPayment(quiz, customerId);
      await savePayment(id, String(payment.id), token);
    } else {
      await savePayment(id, String(payment.id), token);
    }

    if (['RECEIVED', 'CONFIRMED'].includes(String(payment?.status || ''))) {
      return res.status(200).json({ ok: true, paid: true, token });
    }

    const qr = await asaas<any>(`/payments/${encodeURIComponent(String(payment.id))}/pixQrCode`);
    if (!qr?.payload || !qr?.encodedImage) return res.status(502).json({ error: 'Asaas não retornou o QR Code do PIX.' });

    return res.status(200).json({
      ok: true,
      paid: false,
      token,
      payment_id: String(payment.id),
      payload: String(qr.payload),
      encodedImage: String(qr.encodedImage),
      expirationDate: qr.expirationDate || null,
    });
  } catch (error: any) {
    const message = String(error?.message || error || '');
    console.error('Asaas PIX error', message);
    if (message === 'DB_CONFIG' || message.startsWith('DB_')) return res.status(503).json({ error: 'Banco de dados indisponível para o PIX.' });
    if (message === 'ASAAS_NOT_CONFIGURED') return res.status(503).json({ error: 'PIX Asaas não está configurado.' });
    if (message.includes('ASAAS_401')) return res.status(503).json({ error: 'A chave da API do Asaas não foi aceita.' });
    return res.status(500).json({ error: 'Não foi possível gerar o PIX. Tente novamente.' });
  }
}
