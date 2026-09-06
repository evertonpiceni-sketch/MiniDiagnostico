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

function validCpf(value: unknown) {
  const cpf = String(value || '').replace(/\D/g, '');
  if (!/^\d{11}$/.test(cpf) || /^(\d)\1{10}$/.test(cpf)) return false;
  const calc = (length: number) => {
    let sum = 0;
    for (let i = 0; i < length; i++) sum += Number(cpf[i]) * (length + 1 - i);
    const r = (sum * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return calc(9) === Number(cpf[9]) && calc(10) === Number(cpf[10]);
}

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

async function patchQuiz(id: string, body: Record<string, unknown>) {
  await db(`quiz_sessions?quiz_session_id=eq.${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify(body),
  });
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
        'User-Agent': 'MiniDiagnostico/1.0',
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(init.headers || {}),
      },
    });
    const text = await r.text();
    let data: any = {};
    try { data = text ? JSON.parse(text) : {}; } catch { data = {}; }
    if (!r.ok) {
      const detail = Array.isArray(data?.errors)
        ? data.errors.map((e: any) => e?.description || e?.code).filter(Boolean).join(' | ')
        : (data?.message || data?.error || '');
      throw new Error(`ASAAS_${r.status}:${String(detail || 'Falha na API do Asaas').slice(0, 300)}`);
    }
    return data as T;
  } catch (error: any) {
    if (error?.name === 'AbortError') throw new Error('ASAAS_TIMEOUT');
    if (String(error?.message || '').toLowerCase().includes('fetch failed')) throw new Error('ASAAS_CONNECTION');
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function todayBrazil() {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const map = Object.fromEntries(parts.map(p => [p.type, p.value]));
  return `${map.year}-${map.month}-${map.day}`;
}

async function findOrCreateCustomer(quiz: any, cpfCnpj: string) {
  const found = await asaas<any>(`/customers?externalReference=${encodeURIComponent(quiz.quiz_session_id)}&limit=1`);
  const existing = Array.isArray(found?.data) ? found.data[0] : null;
  if (existing?.id) return String(existing.id);
  const mobilePhone = String(quiz.whatsapp || '').replace(/\D/g, '').replace(/^55/, '');
  const created = await asaas<any>('/customers', {
    method: 'POST',
    body: JSON.stringify({ name: String(quiz.nome || 'Cliente Mini Diagnóstico').slice(0, 100), cpfCnpj, mobilePhone: mobilePhone || undefined, externalReference: quiz.quiz_session_id, notificationDisabled: true }),
  });
  if (!created?.id) throw new Error('ASAAS_CUSTOMER_ID_MISSING');
  return String(created.id);
}

async function createPayment(quiz: any, customerId: string) {
  const payment = await asaas<any>('/payments', {
    method: 'POST',
    body: JSON.stringify({ customer: customerId, billingType: 'PIX', value: 9.90, dueDate: todayBrazil(), description: 'Mini Diagnóstico Completo', externalReference: quiz.quiz_session_id }),
  });
  if (!payment?.id) throw new Error('ASAAS_PAYMENT_ID_MISSING');
  return payment;
}

async function savePayment(quizId: string, paymentId: string, token: string) {
  await patchQuiz(quizId, {
    payment_method_selected: 'pix_asaas',
    checkout_attempted_at: new Date().toISOString(),
    checkout_error_code: null,
    checkout_error_message: null,
    checkout_error_at: null,
    asaas_payment_id: paymentId,
    result_access_token_hash: createHash('sha256').update(token).digest('hex'),
  });
}

async function markPaid(quizId: string) {
  await patchQuiz(quizId, {
    payment_status: 'paid',
    paid_at: new Date().toISOString(),
    payment_method_selected: 'pix_asaas',
    checkout_error_code: null,
    checkout_error_message: null,
    checkout_error_at: null,
  });
}

async function recordError(id: string, code: string, message: string) {
  if (!validId(id)) return;
  try {
    await patchQuiz(id, {
      payment_method_selected: 'pix_asaas',
      checkout_attempted_at: new Date().toISOString(),
      checkout_error_code: code.slice(0, 120),
      checkout_error_message: message.slice(0, 500),
      checkout_error_at: new Date().toISOString(),
    });
  } catch (e) {
    console.error('Asaas PIX error persistence failed', e);
  }
}

function publicAsaasError(message: string) {
  const match = message.match(/^ASAAS_(\d{3}):(.*)$/s);
  if (!match) return null;
  const status = Number(match[1]);
  const detail = String(match[2] || '').trim().replace(/\s+/g, ' ').slice(0, 220);
  if (status === 401) return { status: 503, error: 'A chave da API do Asaas não foi aceita.' };
  if (status === 403) return { status: 503, error: `Asaas recusou a operação: ${detail || 'permissão insuficiente.'}` };
  if (status === 400 || status === 422) return { status: 400, error: `Asaas recusou os dados do PIX: ${detail || 'verifique os dados da cobrança.'}` };
  if (status === 404) return { status: 502, error: `Recurso do Asaas não encontrado: ${detail || 'verifique a configuração da conta.'}` };
  if (status === 429) return { status: 503, error: 'O Asaas limitou temporariamente as requisições. Tente novamente em instantes.' };
  return { status: 502, error: `Asaas retornou erro ${status}: ${detail || 'falha temporária.'}` };
}

export default async function handler(req: Req, res: Res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido.' });
  const id = String(req.body?.quiz_session_id || '').trim();
  try {
    if (!validId(id)) return res.status(400).json({ error: 'Sessão do diagnóstico inválida.' });
    await patchQuiz(id, { payment_method_selected: 'pix_asaas', checkout_attempted_at: new Date().toISOString(), checkout_error_code: null, checkout_error_message: null, checkout_error_at: null });
    if (!ASAAS_API_KEY) throw new Error('ASAAS_NOT_CONFIGURED');
    if (RESULT_TOKEN_SECRET.length < 32) throw new Error('RESULT_TOKEN_SECRET_INVALID');

    const cpfCnpj = String(req.body?.cpfCnpj || '').replace(/\D/g, '');
    if (!validCpf(cpfCnpj)) return res.status(400).json({ error: 'Informe um CPF válido para gerar o PIX no Asaas.' });
    const rows = await db<any[]>(`quiz_sessions?quiz_session_id=eq.${encodeURIComponent(id)}&select=quiz_session_id,nome,whatsapp,payment_status,asaas_payment_id`);
    const quiz = rows[0];
    if (!quiz) return res.status(404).json({ error: 'Diagnóstico não encontrado.' });

    const token = resultToken(id);
    if (quiz.payment_status === 'paid') return res.status(200).json({ ok: true, paid: true, token });

    let payment: any = null;
    if (quiz.asaas_payment_id) {
      try {
        payment = await asaas<any>(`/payments/${encodeURIComponent(String(quiz.asaas_payment_id))}`);
        if (String(payment?.externalReference || '') !== id || Number(payment?.value) !== 9.9 || String(payment?.billingType || '') !== 'PIX') throw new Error('ASAAS_PAYMENT_MISMATCH');
      } catch (error: any) {
        if (String(error?.message || '').startsWith('ASAAS_404:')) payment = null;
        else throw error;
      }
    }

    if (!payment) {
      const customerId = await findOrCreateCustomer(quiz, cpfCnpj);
      payment = await createPayment(quiz, customerId);
    }
    await savePayment(id, String(payment.id), token);

    if (['RECEIVED', 'CONFIRMED'].includes(String(payment?.status || ''))) {
      await markPaid(id);
      return res.status(200).json({ ok: true, paid: true, token });
    }

    const qr = await asaas<any>(`/payments/${encodeURIComponent(String(payment.id))}/pixQrCode`);
    if (!qr?.payload || !qr?.encodedImage) throw new Error('ASAAS_QR_MISSING');
    return res.status(200).json({ ok: true, paid: false, token, payment_id: String(payment.id), payload: String(qr.payload), encodedImage: String(qr.encodedImage), expirationDate: qr.expirationDate || null });
  } catch (error: any) {
    const message = String(error?.message || error || '');
    console.error('Asaas PIX error', message);
    await recordError(id, message.split(':')[0] || 'ASAAS_PIX_ERROR', message);
    if (message === 'DB_CONFIG' || message.startsWith('DB_')) return res.status(503).json({ error: 'Banco de dados indisponível para o PIX.' });
    if (message === 'ASAAS_NOT_CONFIGURED') return res.status(503).json({ error: 'PIX Asaas não está configurado.' });
    if (message === 'RESULT_TOKEN_SECRET_INVALID') return res.status(503).json({ error: 'Proteção do resultado não está configurada.' });
    if (message === 'ASAAS_TIMEOUT') return res.status(504).json({ error: 'O Asaas demorou para responder. Tente novamente.' });
    if (message === 'ASAAS_CONNECTION') return res.status(503).json({ error: 'Não foi possível conectar ao Asaas a partir do servidor.' });
    if (message === 'ASAAS_CUSTOMER_ID_MISSING') return res.status(502).json({ error: 'Asaas não retornou o cadastro do cliente.' });
    if (message === 'ASAAS_PAYMENT_ID_MISSING') return res.status(502).json({ error: 'Asaas não retornou a identificação da cobrança PIX.' });
    if (message === 'ASAAS_PAYMENT_MISMATCH') return res.status(409).json({ error: 'A cobrança PIX encontrada não corresponde a este diagnóstico.' });
    if (message === 'ASAAS_QR_MISSING') return res.status(502).json({ error: 'Asaas não retornou o QR Code do PIX.' });
    const asaasError = publicAsaasError(message);
    if (asaasError) return res.status(asaasError.status).json({ error: asaasError.error });
    return res.status(500).json({ error: 'Falha técnica ao gerar PIX.' });
  }
}
