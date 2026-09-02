import express from 'express';
import path from 'path';
import cors from 'cors';
import Stripe from 'stripe';
import { Resend } from 'resend';
import { randomUUID } from 'node:crypto';

const app = express();
const PORT = Number(process.env.PORT || 3000);
const isProduction = process.env.NODE_ENV === 'production';

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) console.warn(`WARNING: ${name} environment variable is missing.`);
  return value || '';
}

const supabaseUrl = requiredEnv('SUPABASE_URL').replace(/\/$/, '');
const supabaseServiceRoleKey = requiredEnv('SUPABASE_SERVICE_ROLE_KEY');
const configuredAppUrl = requiredEnv('APP_URL').replace(/\/$/, '');
const corsOrigin = process.env.CORS_ORIGIN?.trim() || configuredAppUrl;
const stripeSecretKey = requiredEnv('STRIPE_SECRET_KEY');
const stripeWebhookSecret = requiredEnv('STRIPE_WEBHOOK_SECRET');
const stripePriceId = requiredEnv('STRIPE_PRICE_ID');
const resendApiKey = process.env.RESEND_API_KEY?.trim();
const resend = resendApiKey ? new Resend(resendApiKey) : null;

function getStripe(): Stripe {
  if (!stripeSecretKey) throw new Error('STRIPE_NOT_CONFIGURED');
  return new Stripe(stripeSecretKey);
}

if (stripeSecretKey.startsWith('sk_test_') && isProduction) console.warn('Stripe is using a test key while NODE_ENV=production.');

const allowedOrigins = new Set(corsOrigin.split(',').map(origin => origin.trim()).filter(Boolean));
app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(cors({ origin: (origin, callback) => {
  if (!origin || allowedOrigins.size === 0 || allowedOrigins.has(origin)) return callback(null, true);
  return callback(new Error('CORS origin not allowed'));
} }));

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[char] || char));
}
function normalizeEmail(value: unknown): string {
  if (typeof value !== 'string') throw new Error('Email inválido.');
  const email = value.trim().toLowerCase();
  if (email.length > 254 || !/^\S+@\S+\.\S+$/.test(email)) throw new Error('Email inválido.');
  return email;
}
function normalizeName(value: unknown): string {
  if (typeof value !== 'string') throw new Error('Nome inválido.');
  const name = value.trim().replace(/\s+/g, ' ');
  if (name.length < 1 || name.length > 120) throw new Error('Nome inválido.');
  return name;
}
function validateAnswers(value: unknown): Record<string, number> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Respostas inválidas.');
  const answers = value as Record<string, unknown>;
  const keys = Object.keys(answers);
  if (keys.length !== 12 || keys.some(key => !/^([1-9]|1[0-2])$/.test(key))) throw new Error('Respostas incompletas.');
  const normalized: Record<string, number> = {};
  for (let id = 1; id <= 12; id++) {
    const raw = answers[String(id)];
    if (!Number.isInteger(raw) || (raw as number) < 0 || (raw as number) > 3) throw new Error('Resposta inválida.');
    normalized[String(id)] = raw as number;
  }
  return normalized;
}
function calculateScores(answers: Record<string, number>) {
  let medo = 0, inseguranca = 0, procrastinacao = 0;
  for (let id = 1; id <= 4; id++) medo += answers[String(id)];
  for (let id = 5; id <= 8; id++) inseguranca += answers[String(id)];
  for (let id = 9; id <= 12; id++) procrastinacao += answers[String(id)];
  let dominante = 'MEDO', max = medo;
  if (inseguranca > max) { dominante = 'INSEGURANÇA'; max = inseguranca; }
  if (procrastinacao > max) dominante = 'PROCRASTINAÇÃO';
  return { score_medo: medo, score_inseguranca: inseguranca, score_procrastinacao: procrastinacao, resultado_dominante: dominante };
}

type Quiz = {
  quiz_session_id: string; nome: string; email: string; respostas: Record<string, number>;
  score_medo: number; score_inseguranca: number; score_procrastinacao: number; resultado_dominante: string;
  payment_status: 'pending' | 'paid'; created_at?: string; paid_at?: string | null;
  stripe_checkout_session_id?: string | null; email_sent_at?: string | null;
};

function isValidSupabaseUrl(value: string): boolean {
  try { const url = new URL(value); return url.protocol === 'https:' && Boolean(url.hostname) && !url.username && !url.password; }
  catch { return false; }
}
async function dbRequest<T>(pathName: string, init: RequestInit = {}): Promise<T> {
  if (!supabaseUrl || !isValidSupabaseUrl(supabaseUrl)) throw new Error('SUPABASE_URL_INVALID');
  if (!supabaseServiceRoleKey || supabaseServiceRoleKey.length < 20) throw new Error('SUPABASE_KEY_INVALID');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/${pathName}`, {
      ...init, signal: controller.signal,
      headers: { apikey: supabaseServiceRoleKey, Authorization: `Bearer ${supabaseServiceRoleKey}`, 'Content-Type': 'application/json', ...(init.headers || {}) },
    });
    const body = await response.text();
    if (!response.ok) {
      let detail = body.slice(0, 500);
      try { const parsed = JSON.parse(body); detail = parsed.message || parsed.hint || parsed.details || detail; } catch {}
      console.error('Supabase request failed:', response.status, detail);
      const error = new Error(`SUPABASE_DB_ERROR:${response.status}`); (error as any).status = response.status; throw error;
    }
    if (response.status === 204 || !body) return undefined as T;
    return JSON.parse(body) as T;
  } catch (err: any) {
    if (err?.name === 'AbortError') throw new Error('SUPABASE_TIMEOUT');
    if (err?.message?.includes('fetch failed')) throw new Error('SUPABASE_CONNECTION_ERROR');
    throw err;
  } finally { clearTimeout(timer); }
}

async function insertQuiz(quiz: Quiz): Promise<void> {
  // INSERT only the core columns, so optional timestamp/payment metadata columns cannot break quiz creation.
  const row = {
    quiz_session_id: quiz.quiz_session_id, nome: quiz.nome, email: quiz.email, respostas: quiz.respostas,
    score_medo: quiz.score_medo, score_inseguranca: quiz.score_inseguranca, score_procrastinacao: quiz.score_procrastinacao,
    resultado_dominante: quiz.resultado_dominante, payment_status: quiz.payment_status,
  };
  await dbRequest('quiz_sessions', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(row) });
}
async function getQuiz(id: string): Promise<Quiz | null> {
  const rows = await dbRequest<Quiz[]>(`quiz_sessions?quiz_session_id=eq.${encodeURIComponent(id)}&select=*`);
  return rows[0] || null;
}
async function updateQuiz(id: string, patch: Partial<Quiz>): Promise<void> {
  await dbRequest(`quiz_sessions?quiz_session_id=eq.${encodeURIComponent(id)}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(patch) });
}
function getAppUrl(req: express.Request): string {
  if (configuredAppUrl) return configuredAppUrl;
  const proto = String(req.headers['x-forwarded-proto'] || req.protocol || 'https').split(',')[0].trim();
  const host = String(req.headers['x-forwarded-host'] || req.get('host') || '').split(',')[0].trim();
  if (!host) throw new Error('APP_URL_NOT_CONFIGURED');
  return `${proto}://${host}`.replace(/\/$/, '');
}
const rateBuckets = new Map<string, { count: number; resetAt: number }>();
function rateLimit(max: number, windowMs: number) {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const forwarded = req.headers['x-forwarded-for'];
    const ip = typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : req.ip || 'unknown';
    const key = `${req.path}:${ip}`, now = Date.now(), current = rateBuckets.get(key);
    if (!current || current.resetAt <= now) { rateBuckets.set(key, { count: 1, resetAt: now + windowMs }); return next(); }
    if (current.count >= max) return res.status(429).json({ error: 'Muitas requisições. Tente novamente mais tarde.' });
    current.count += 1; return next();
  };
}

app.post('/api/webhook', express.raw({ type: 'application/json', limit: '256kb' }), async (req, res) => {
  const signature = req.headers['stripe-signature'];
  if (typeof signature !== 'string') return res.status(400).json({ error: 'Assinatura Stripe ausente.' });
  try {
    if (!stripeWebhookSecret || !stripeSecretKey) return res.status(500).json({ error: 'Webhook Stripe não configurado.' });
    const event = getStripe().webhooks.constructEvent(req.body, signature, stripeWebhookSecret);
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      const quizSessionId = session.client_reference_id || session.metadata?.quiz_session_id;
      if (quizSessionId) {
        const quiz = await getQuiz(quizSessionId);
        if (quiz && quiz.payment_status !== 'paid') {
          await updateQuiz(quizSessionId, { payment_status: 'paid', paid_at: new Date().toISOString(), stripe_checkout_session_id: session.id });
          if (resend && quiz.email) {
            try {
              await resend.emails.send({ from: process.env.RESEND_FROM_EMAIL || 'Mini Diagnóstico <onboarding@resend.dev>', to: quiz.email, subject: 'Seu Mini Diagnóstico está pronto!', html: `<p>Olá, ${escapeHtml(String(quiz.nome || ''))}.</p><p>Seu diagnóstico completo já está disponível.</p>` });
              await updateQuiz(quizSessionId, { email_sent_at: new Date().toISOString() });
            } catch (emailError) { console.error('Email delivery failed:', emailError); }
          }
        }
      }
    }
    return res.json({ received: true });
  } catch (error: any) { console.error('Stripe webhook verification failed:', error?.message || error); return res.status(400).json({ error: 'Webhook inválido.' }); }
});

app.use(express.json({ limit: '64kb', strict: true }));
app.get('/api/health', (_req, res) => res.json({ status: 'ok', databaseConfigured: Boolean(supabaseUrl && supabaseServiceRoleKey), stripeConfigured: Boolean(stripeSecretKey && stripePriceId) }));

app.post('/api/quiz', rateLimit(10, 15 * 60 * 1000), async (req, res) => {
  try {
    const nome = normalizeName(req.body?.nome), email = normalizeEmail(req.body?.email), respostas = validateAnswers(req.body?.respostas);
    const scores = calculateScores(respostas);
    const quiz: Quiz = { quiz_session_id: randomUUID(), nome, email, respostas, ...scores, payment_status: 'pending' };
    await insertQuiz(quiz);
    return res.status(201).json({ quiz_session_id: quiz.quiz_session_id });
  } catch (error: any) {
    const message = String(error?.message || ''); console.error('Quiz creation error:', message);
    if (message === 'SUPABASE_URL_INVALID') return res.status(503).json({ error: 'Banco de dados não configurado corretamente.' });
    if (message === 'SUPABASE_KEY_INVALID') return res.status(503).json({ error: 'Credencial do banco de dados não configurada corretamente.' });
    if (message === 'SUPABASE_TIMEOUT') return res.status(504).json({ error: 'O banco de dados demorou para responder. Tente novamente.' });
    if (message === 'SUPABASE_CONNECTION_ERROR') return res.status(503).json({ error: 'Não foi possível conectar ao banco de dados.' });
    if (message.startsWith('SUPABASE_DB_ERROR:')) {
      const code = Number(message.split(':')[1]);
      if (code === 401 || code === 403) return res.status(503).json({ error: 'A credencial do banco de dados foi rejeitada.' });
      if (code === 404) return res.status(503).json({ error: 'A tabela do diagnóstico não foi encontrada no banco de dados.' });
      if (code === 409) return res.status(409).json({ error: 'O diagnóstico já existe. Tente novamente.' });
      return res.status(503).json({ error: 'Não foi possível salvar o diagnóstico no banco de dados.' });
    }
    return res.status(400).json({ error: message || 'Dados do quiz inválidos.' });
  }
});

app.post('/api/checkout', rateLimit(10, 15 * 60 * 1000), async (req, res) => {
  try {
    const id = typeof req.body?.quiz_session_id === 'string' ? req.body.quiz_session_id : '';
    if (!/^[0-9a-f-]{36}$/i.test(id)) return res.status(400).json({ error: 'Sessão inválida.' });
    if (!stripeSecretKey || !stripePriceId) return res.status(503).json({ error: 'Pagamento ainda não está configurado.' });
    const quiz = await getQuiz(id);
    if (!quiz) return res.status(404).json({ error: 'Quiz não encontrado.' });
    if (quiz.payment_status === 'paid') return res.status(409).json({ error: 'Este resultado já foi pago.' });
    const appUrl = getAppUrl(req);
    const session = await getStripe().checkout.sessions.create({ payment_method_types: ['card', 'pix'], payment_method_options: { card: { installments: { enabled: true } } }, line_items: [{ price: stripePriceId, quantity: 1 }], mode: 'payment', success_url: `${appUrl}/resultado?session_id=${encodeURIComponent(id)}`, cancel_url: `${appUrl}/paywall?session_id=${encodeURIComponent(id)}&canceled=true`, client_reference_id: id, customer_email: quiz.email, metadata: { quiz_session_id: id } });
    await updateQuiz(id, { stripe_checkout_session_id: session.id });
    return res.json({ url: session.url });
  } catch (error: any) { console.error('Checkout error:', error?.message || error); if (error?.message === 'APP_URL_NOT_CONFIGURED') return res.status(500).json({ error: 'APP_URL não está configurada.' }); return res.status(502).json({ error: 'Não foi possível iniciar o pagamento.' }); }
});

app.get('/api/quiz/:id', rateLimit(30, 15 * 60 * 1000), async (req, res) => {
  try {
    const id = req.params.id;
    if (!/^[0-9a-f-]{36}$/i.test(id)) return res.status(400).json({ error: 'Sessão inválida.' });
    const quiz = await getQuiz(id);
    if (!quiz) return res.status(404).json({ error: 'Quiz não encontrado.' });
    if (quiz.payment_status !== 'paid') return res.json({ quiz_session_id: quiz.quiz_session_id, payment_status: quiz.payment_status });
    return res.json({ quiz_session_id: quiz.quiz_session_id, nome: quiz.nome, email: quiz.email, score_medo: quiz.score_medo, score_inseguranca: quiz.score_inseguranca, score_procrastinacao: quiz.score_procrastinacao, resultado_dominante: quiz.resultado_dominante, payment_status: quiz.payment_status });
  } catch (error: any) { console.error('Quiz result error:', error?.message || error); return res.status(503).json({ error: 'Não foi possível consultar o diagnóstico.' }); }
});

app.get('*', (_req, res) => res.sendFile(path.join(process.cwd(), 'dist', 'index.html')));
if (!process.env.VERCEL) app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
export default app;
export { app };
