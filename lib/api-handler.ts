import Stripe from 'stripe';
import { Resend } from 'resend';
import { randomUUID } from 'node:crypto';

type VercelRequest = NodeJS.ReadableStream & { method?: string; url?: string; query: Record<string, string | string[] | undefined>; headers: Record<string, string | string[] | undefined> };
type VercelResponse = { status: (code: number) => VercelResponse; json: (data: unknown) => unknown };

export const config = { api: { bodyParser: false } };

const cleanEnv = (value: string | undefined) => {
  const trimmed = (value || '').trim();
  return trimmed.replace(/^(["'])(.*)\1$/, '$2').trim();
};

const RAW_DB_URL = cleanEnv(process.env.SUPABASE_URL).replace(/\/$/, '');
const DB_KEY = cleanEnv(process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY);
const STRIPE_KEY = cleanEnv(process.env.STRIPE_SECRET_KEY);
const WEBHOOK_SECRET = cleanEnv(process.env.STRIPE_WEBHOOK_SECRET);
const PRICE_ID = cleanEnv(process.env.STRIPE_PRICE_ID);
const APP_URL = cleanEnv(process.env.APP_URL).replace(/\/$/, '');
const RESEND_KEY = cleanEnv(process.env.RESEND_API_KEY);
const RESEND_FROM = cleanEnv(process.env.RESEND_FROM_EMAIL);

const send = (res: VercelResponse, status: number, data: unknown) => res.status(status).json(data);
const validId = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);

function dbConfig() {
  if (!RAW_DB_URL) throw new Error('DB_CONFIG_URL_MISSING');
  if (!DB_KEY || DB_KEY.length < 20) throw new Error('DB_CONFIG_KEY_MISSING');
  if (DB_KEY.startsWith('sb_publishable_')) throw new Error('DB_KEY_WRONG_TYPE');

  let parsed: URL;
  try { parsed = new URL(RAW_DB_URL); } catch { throw new Error('DB_URL_INVALID'); }
  if (parsed.protocol !== 'https:' || !parsed.hostname.endsWith('.supabase.co')) throw new Error('DB_URL_INVALID');

  return { url: parsed.origin, key: DB_KEY };
}

const rateBuckets = new Map<string, { count: number; resetAt: number }>();
function rateLimit(req: VercelRequest, max: number, windowMs: number): boolean {
  const forwarded = req.headers['x-forwarded-for'];
  const ip = typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : 'unknown';
  const key = `${req.method || 'UNKNOWN'}:${String(req.url || '').split('?')[0]}:${ip}`;
  const now = Date.now();
  const current = rateBuckets.get(key);
  if (!current || current.resetAt <= now) {
    rateBuckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (current.count >= max) return false;
  current.count += 1;
  return true;
}

async function raw(req: VercelRequest) {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as any));
  return Buffer.concat(chunks);
}

async function body(req: VercelRequest) {
  const b = await raw(req);
  if (!b.length) return {};
  try { return JSON.parse(b.toString('utf8')); } catch { throw new Error('JSON_INVALID'); }
}

async function db<T>(resource: string, init: RequestInit = {}): Promise<T> {
  const { url, key } = dbConfig();
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 10000);
  try {
    const r = await fetch(`${url}/rest/v1/${resource}`, {
      ...init,
      signal: ctl.signal,
      headers: {
        apikey: key,
        ...(key.startsWith('eyJ') ? { Authorization: `Bearer ${key}` } : {}),
        'Content-Type': 'application/json',
        ...(init.headers || {}),
      },
    });
    const text = await r.text();
    if (!r.ok) {
      console.error('Supabase', r.status, text.slice(0, 500));
      throw new Error(`DB_${r.status}`);
    }
    return text ? JSON.parse(text) : undefined as T;
  } catch (e: any) {
    if (e?.name === 'AbortError') throw new Error('DB_TIMEOUT');
    if (e?.message === 'fetch failed' || e?.cause?.code === 'ENOTFOUND' || e?.cause?.code === 'EAI_AGAIN' || e?.cause?.code === 'ECONNREFUSED') throw new Error('DB_CONNECTION');
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

function validateAnswers(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Respostas inválidas.');
  const a = value as Record<string, unknown>, keys = Object.keys(a);
  if (keys.length !== 12 || keys.some(k => !/^([1-9]|1[0-2])$/.test(k))) throw new Error('Respostas incompletas.');
  const out: Record<string, number> = {};
  for (let i = 1; i <= 12; i++) {
    const v = a[String(i)];
    if (!Number.isInteger(v) || (v as number) < 0 || (v as number) > 3) throw new Error('Resposta inválida.');
    out[String(i)] = v as number;
  }
  return out;
}

function scores(a: Record<string, number>) {
  let medo = 0, inseguranca = 0, procrastinacao = 0;
  for (let i = 1; i <= 4; i++) medo += a[String(i)];
  for (let i = 5; i <= 8; i++) inseguranca += a[String(i)];
  for (let i = 9; i <= 12; i++) procrastinacao += a[String(i)];
  let resultado_dominante = 'MEDO', max = medo;
  if (inseguranca > max) { resultado_dominante = 'INSEGURANÇA'; max = inseguranca; }
  if (procrastinacao > max) resultado_dominante = 'PROCRASTINAÇÃO';
  return { score_medo: medo, score_inseguranca: inseguranca, score_procrastinacao: procrastinacao, resultado_dominante };
}

async function findQuiz(id: string) {
  return (await db<any[]>(`quiz_sessions?quiz_session_id=eq.${encodeURIComponent(id)}&select=quiz_session_id,nome,email,respostas,score_medo,score_inseguranca,score_procrastinacao,resultado_dominante,payment_status,paid_at,email_sent_at,stripe_checkout_session_id`))[0] || null;
}

async function findDuplicate(email: string, respostas: Record<string, number>) {
  const rows = await db<any[]>(`quiz_sessions?email=eq.${encodeURIComponent(email)}&select=quiz_session_id,email,respostas,payment_status,email_sent_at&limit=20`);
  return rows.find((row) => {
    if (!row?.quiz_session_id || !validId(String(row.quiz_session_id))) return false;
    if (String(row.email || '').toLowerCase() !== email) return false;
    try { return JSON.stringify(row.respostas || {}) === JSON.stringify(respostas); } catch { return false; }
  }) || null;
}

async function patch(id: string, data: Record<string, unknown>) {
  await db(`quiz_sessions?quiz_session_id=eq.${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify(data),
  });
}

function appUrl(req: VercelRequest) {
  if (APP_URL) return APP_URL;
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0].trim();
  return `https://${host}`;
}

function escapeHtml(value: unknown) {
  return String(value ?? '').replace(/[&<>\"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '\"': '&quot;', "'": '&#039;' } as any)[c]);
}

function answerLabel(value: unknown) {
  return ({ 0: 'Nunca', 1: 'Às vezes', 2: 'Quase sempre', 3: 'Sempre' } as Record<number, string>)[Number(value)] || 'Não informado';
}

async function sendResultEmail(q: any) {
  if (!RESEND_KEY || !RESEND_FROM || !q?.email) throw new Error('EMAIL_CONFIG');
  const respostas = q.respostas && typeof q.respostas === 'object' ? q.respostas : {};
  const items = Array.from({ length: 12 }, (_, i) => `<li>Pergunta ${i + 1}: <strong>${escapeHtml(answerLabel(respostas[String(i + 1)] ?? respostas[i + 1]))}</strong></li>`).join('');
  const html = `<div style="font-family:Arial,sans-serif;line-height:1.6"><h2>Seu Mini Diagnóstico está pronto!</h2><p>Olá, ${escapeHtml(q.nome)}.</p><p>Seu pagamento foi confirmado e este é o resultado do seu quiz:</p><p><strong>Padrão dominante: ${escapeHtml(q.resultado_dominante)}</strong></p><ul><li>Medo: ${Number(q.score_medo) || 0} pontos</li><li>Insegurança: ${Number(q.score_inseguranca) || 0} pontos</li><li>Procrastinação: ${Number(q.score_procrastinacao) || 0} pontos</li></ul><h3>Suas respostas</h3><ol>${items}</ol><p>Guarde este e-mail para consultar seu resultado.</p></div>`;
  const result = await new Resend(RESEND_KEY).emails.send({ from: RESEND_FROM, to: q.email, subject: 'Seu resultado do Mini Diagnóstico', html });
  if ((result as any)?.error) throw new Error(`EMAIL_SEND_${(result as any).error.message || 'ERROR'}`);
}

async function confirmStripeSession(q: any, s: Stripe.Checkout.Session) {
  const linkedQuizId = s.metadata?.quiz_session_id || s.client_reference_id;
  if (linkedQuizId !== q.quiz_session_id || s.payment_status !== 'paid') return false;
  if (q.stripe_checkout_session_id && q.stripe_checkout_session_id !== s.id) return false;

  if (q.payment_status !== 'paid') {
    const paidAt = new Date().toISOString();
    await patch(q.quiz_session_id, {
      payment_status: 'paid',
      paid_at: paidAt,
      stripe_checkout_session_id: s.id,
    });
    q.payment_status = 'paid';
    q.paid_at = paidAt;
    q.stripe_checkout_session_id = s.id;
  }

  if (!q.email_sent_at && RESEND_KEY && RESEND_FROM) {
    try {
      await sendResultEmail(q);
      const sentAt = new Date().toISOString();
      await patch(q.quiz_session_id, { email_sent_at: sentAt });
      q.email_sent_at = sentAt;
    } catch (e) {
      console.error('Email delivery failed', e);
    }
  }

  return true;
}

async function quiz(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'POST') {
    if (!rateLimit(req, 10, 15 * 60 * 1000)) return send(res, 429, { error: 'Muitas tentativas. Aguarde alguns minutos e tente novamente.' });
    try {
      const b = await body(req);
      const nome = typeof b.nome === 'string' ? b.nome.trim().replace(/\s+/g, ' ') : '';
      const email = typeof b.email === 'string' ? b.email.trim().toLowerCase() : '';
      const respostas = validateAnswers(b.respostas);
      if (!nome || nome.length > 120) throw new Error('Nome inválido.');
      if (email.length > 254 || !/^\S+@\S+\.\S+$/.test(email)) throw new Error('Email inválido.');
      const duplicate = await findDuplicate(email, respostas);
      if (duplicate) return send(res, 200, { ok: true, quiz_session_id: duplicate.quiz_session_id, reused: true });
      const row = { quiz_session_id: randomUUID(), nome, email, respostas, ...scores(respostas), payment_status: 'pending' };
      await db('quiz_sessions', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(row) });
      return send(res, 201, { ok: true, quiz_session_id: row.quiz_session_id });
    } catch (e: any) {
      const m = String(e?.message || '');
      if (m === 'DB_CONFIG_URL_MISSING' || m === 'DB_CONFIG_KEY_MISSING') return send(res, 503, { error: 'Supabase não configurado corretamente.', code: m });
      if (m === 'DB_KEY_WRONG_TYPE') return send(res, 503, { error: 'A chave do Supabase configurada não é uma chave server-side.', code: m });
      if (m === 'DB_URL_INVALID') return send(res, 503, { error: 'SUPABASE_URL inválida. Use a URL do projeto no formato https://SEU-PROJETO.supabase.co.', code: m });
      if (m === 'DB_TIMEOUT') return send(res, 504, { error: 'Supabase demorou para responder. Verifique o projeto Supabase.', code: m });
      if (m === 'DB_CONNECTION') return send(res, 503, { error: 'Não foi possível conectar ao Supabase. Verifique SUPABASE_URL e se o projeto está acessível.', code: m });
      if (m === 'DB_401') return send(res, 503, { error: 'Supabase recusou a chave. Confirme SUPABASE_SECRET_KEY (recomendada) ou SUPABASE_SERVICE_ROLE_KEY e SUPABASE_URL.', code: m });
      if (m === 'DB_403') return send(res, 503, { error: 'Supabase recusou a permissão da chave. Use SUPABASE_SECRET_KEY ou a service_role legada somente no backend.', code: m });
      if (m === 'DB_404') return send(res, 503, { error: 'A tabela quiz_sessions não foi encontrada no projeto Supabase informado.', code: m });
      if (m === 'DB_409') return send(res, 409, { error: 'Não foi possível criar uma nova sessão. Tente novamente.', code: m });
      if (m === 'DB_400') return send(res, 503, { error: 'Supabase rejeitou os dados da sessão. Verifique se o schema quiz_sessions está atualizado.', code: m });
      return send(res, 400, { error: m || 'Não foi possível salvar o diagnóstico.' });
    }
  }

  if (req.method === 'GET') {
    if (!rateLimit(req, 60, 15 * 60 * 1000)) return send(res, 429, { error: 'Muitas consultas. Aguarde alguns minutos e tente novamente.' });
    const id = String(req.query.id || '');
    if (!validId(id)) return send(res, 400, { error: 'Sessão inválida.' });
    try {
      const q = await findQuiz(id);
      if (!q) return send(res, 404, { error: 'Quiz não encontrado.' });
      if (q.payment_status !== 'paid') return send(res, 200, { quiz_session_id: q.quiz_session_id, payment_status: q.payment_status });
      return send(res, 200, { quiz_session_id: q.quiz_session_id, nome: q.nome, score_medo: q.score_medo, score_inseguranca: q.score_inseguranca, score_procrastinacao: q.score_procrastinacao, resultado_dominante: q.resultado_dominante, payment_status: q.payment_status });
    } catch (e: any) {
      const m = String(e?.message || '');
      return send(res, m === 'DB_TIMEOUT' ? 504 : 503, { error: 'Não foi possível consultar o diagnóstico.', code: m || 'DB_UNKNOWN' });
    }
  }

  return send(res, 405, { error: 'Método não permitido.' });
}

async function checkout(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return send(res, 405, { error: 'Método não permitido.' });
  if (!rateLimit(req, 10, 15 * 60 * 1000)) return send(res, 429, { error: 'Muitas tentativas de pagamento. Aguarde alguns minutos e tente novamente.' });
  try {
    const b = await body(req), id = typeof b.quiz_session_id === 'string' ? b.quiz_session_id : '';
    if (!validId(id)) return send(res, 400, { error: 'Sessão inválida.' });
    if (!STRIPE_KEY || !PRICE_ID) return send(res, 503, { error: 'Pagamento ainda não está configurado.' });
    const q = await findQuiz(id);
    if (!q) return send(res, 404, { error: 'Quiz não encontrado.' });
    if (q.payment_status === 'paid') return send(res, 409, { error: 'Este resultado já foi pago.' });

    const s = await new Stripe(STRIPE_KEY).checkout.sessions.create({
      payment_method_types: ['card', 'pix'],
      payment_method_options: { card: { installments: { enabled: true } } },
      line_items: [{ price: PRICE_ID, quantity: 1 }],
      mode: 'payment',
      success_url: `${appUrl(req)}/resultado?session_id=${encodeURIComponent(id)}`,
      cancel_url: `${appUrl(req)}/paywall?session_id=${encodeURIComponent(id)}&canceled=true`,
      client_reference_id: id,
      customer_email: q.email,
      metadata: { quiz_session_id: id },
    });

    if (!s.url) return send(res, 502, { error: 'Stripe não retornou uma URL de pagamento.' });
    await patch(id, { stripe_checkout_session_id: s.id });
    return send(res, 200, { ok: true, url: s.url });
  } catch (e) {
    console.error('Checkout', e);
    return send(res, 502, { error: 'Não foi possível iniciar o pagamento.' });
  }
}

async function verifyPayment(req: VercelRequest, res: VercelResponse, id: string) {
  if (req.method !== 'POST') return send(res, 405, { error: 'Método não permitido.' });
  if (!rateLimit(req, 60, 15 * 60 * 1000)) return send(res, 429, { error: 'Muitas verificações. Aguarde alguns minutos e tente novamente.' });
  if (!validId(id)) return send(res, 400, { error: 'Sessão inválida.' });

  try {
    const q = await findQuiz(id);
    if (!q) return send(res, 404, { error: 'Quiz não encontrado.' });
    if (q.payment_status === 'paid') return send(res, 200, { payment_status: 'paid' });

    // PIX manual/direto nunca é confirmado por uma instrução do navegador.
    // Só uma Checkout Session criada e salva pelo servidor pode liberar o resultado.
    const checkoutId = String(q.stripe_checkout_session_id || '');
    if (!checkoutId.startsWith('cs_') || !STRIPE_KEY) return send(res, 200, { payment_status: 'pending' });

    const s = await new Stripe(STRIPE_KEY).checkout.sessions.retrieve(checkoutId);
    const confirmed = await confirmStripeSession(q, s);
    return send(res, 200, { payment_status: confirmed ? 'paid' : 'pending' });
  } catch (e) {
    console.error('Verify payment', e);
    return send(res, 503, { error: 'Não foi possível verificar o pagamento.', payment_status: 'pending' });
  }
}

async function webhook(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return send(res, 405, { error: 'Método não permitido.' });
  if (!STRIPE_KEY || !WEBHOOK_SECRET) return send(res, 500, { error: 'Webhook Stripe não configurado.' });

  try {
    const signature = req.headers['stripe-signature'];
    if (typeof signature !== 'string') return send(res, 400, { error: 'Assinatura Stripe ausente.' });
    const event = new Stripe(STRIPE_KEY).webhooks.constructEvent(await raw(req), signature, WEBHOOK_SECRET);

    if (event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') {
      const s = event.data.object as Stripe.Checkout.Session;
      const id = s.metadata?.quiz_session_id || s.client_reference_id;
      if (id && validId(id)) {
        const q = await findQuiz(id);
        if (q) await confirmStripeSession(q, s);
      }
    }

    return send(res, 200, { received: true });
  } catch (e) {
    console.error('Webhook', e);
    return send(res, 400, { error: 'Webhook inválido.' });
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const rawPath = String(req.url || '').split('?')[0].replace(/\/$/, '');
  const p = rawPath.startsWith('/api/') ? rawPath : `/api${rawPath}`;

  if (p.endsWith('/health')) {
    let configured = false;
    let database = 'not_configured';
    try {
      dbConfig();
      configured = true;
      await db<any[]>('quiz_sessions?select=quiz_session_id&limit=1');
      database = 'connected';
    } catch (e: any) {
      database = String(e?.message || 'DB_UNKNOWN');
    }
    const healthy = database === 'connected';
    return send(res, healthy ? 200 : 503, {
      status: healthy ? 'ok' : 'degraded',
      databaseConfigured: configured,
      database,
      stripeConfigured: Boolean(STRIPE_KEY && PRICE_ID && WEBHOOK_SECRET),
      resendConfigured: Boolean(RESEND_KEY && RESEND_FROM),
      resendFromConfigured: Boolean(cleanEnv(process.env.RESEND_FROM_EMAIL)),
    });
  }

  if (p.endsWith('/webhook')) return webhook(req, res);
  if (p.endsWith('/checkout')) return checkout(req, res);
  if (p.endsWith('/quiz')) return quiz(req, res);

  const verifyMatch = p.match(/\/quiz\/([^/]+)\/verify-payment$/);
  if (verifyMatch) return verifyPayment(req, res, verifyMatch[1]);

  const match = p.match(/\/quiz\/([^/]+)$/);
  if (match) {
    req.query.id = match[1];
    return quiz(req, res);
  }

  return send(res, 404, { error: 'Rota não encontrada.' });
}
