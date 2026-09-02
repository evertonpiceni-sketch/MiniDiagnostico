import express from 'express';
import path from 'path';
import cors from 'cors';
import Stripe from 'stripe';
import { Resend } from 'resend';
import { v4 as uuidv4 } from 'uuid';

const app = express();
const PORT = Number(process.env.PORT || 3000);
const isProduction = process.env.NODE_ENV === 'production';

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    console.warn(`WARNING: ${name} environment variable is missing. Some features may not work until it is configured.`);
    return '';
  }
  return value;
}

const supabaseUrl = requiredEnv('SUPABASE_URL').replace(/\/$/, '');
const supabaseServiceRoleKey = requiredEnv('SUPABASE_SERVICE_ROLE_KEY');
const appUrl = requiredEnv('APP_URL').replace(/\/$/, '');
const corsOrigin = process.env.CORS_ORIGIN?.trim() || appUrl;
const stripeSecretKey = requiredEnv('STRIPE_SECRET_KEY');
const stripeWebhookSecret = requiredEnv('STRIPE_WEBHOOK_SECRET');
const stripePriceId = requiredEnv('STRIPE_PRICE_ID');
const stripe = new Stripe(stripeSecretKey);
const resendApiKey = process.env.RESEND_API_KEY?.trim();
const resend = resendApiKey ? new Resend(resendApiKey) : null;

if (stripeSecretKey.startsWith('sk_test_') && isProduction) {
  console.warn('Stripe is using a test key while NODE_ENV=production. Configure the live key before launch.');
}

const allowedOrigins = new Set(corsOrigin.split(',').map(origin => origin.trim()).filter(Boolean));
app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(cors());

// Stripe requires the raw request body for signature verification. Keep this route before express.json().
app.post('/api/webhook', express.raw({ type: 'application/json', limit: '256kb' }), async (req, res) => {
  const signature = req.headers['stripe-signature'];
  if (typeof signature !== 'string') return res.status(400).json({ error: 'Assinatura Stripe ausente.' });

  try {
    const event = stripe.webhooks.constructEvent(req.body, signature, stripeWebhookSecret);

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      const quizSessionId = session.client_reference_id;
      if (quizSessionId) {
        const quiz = await getQuiz(quizSessionId);
        if (quiz && quiz.payment_status !== 'paid') {
          await updateQuiz(quizSessionId, {
            payment_status: 'paid',
            paid_at: new Date().toISOString(),
            stripe_checkout_session_id: session.id,
          });

          if (resend && quiz.email) {
            try {
              await resend.emails.send({
                from: process.env.RESEND_FROM_EMAIL || 'Mini Diagnóstico <onboarding@resend.dev>',
                to: quiz.email,
                subject: 'Seu Mini Diagnóstico está pronto!',
                html: `<p>Olá, ${escapeHtml(String(quiz.nome || ''))}.</p><p>Seu diagnóstico completo já está disponível.</p>`,
              });
              await updateQuiz(quizSessionId, { email_sent_at: new Date().toISOString() });
            } catch (emailError) {
              console.error('Email delivery failed:', emailError);
            }
          }
        }
      }
    }

    return res.json({ received: true });
  } catch (error: any) {
    console.error('Stripe webhook verification failed:', error?.message || error);
    return res.status(400).json({ error: 'Webhook inválido.' });
  }
});

app.use(express.json({ limit: '64kb', strict: true }));

const rateBuckets = new Map<string, { count: number; resetAt: number }>();
function rateLimit(max: number, windowMs: number) {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const forwarded = req.headers['x-forwarded-for'];
    const ip = typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : req.ip || 'unknown';
    const key = `${req.path}:${ip}`;
    const now = Date.now();
    const current = rateBuckets.get(key);
    if (!current || current.resetAt <= now) {
      rateBuckets.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }
    if (current.count >= max) return res.status(429).json({ error: 'Muitas requisições. Tente novamente mais tarde.' });
    current.count += 1;
    return next();
  };
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[char] || char));
}

function normalizeEmail(value: unknown): string {
  if (typeof value !== 'string') throw new Error('Email inválido.');
  const email = value.trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Email inválido.');
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
  for (let id = 1; id <= 12; id += 1) {
    const raw = answers[String(id)];
    if (!Number.isInteger(raw) || (raw as number) < 0 || (raw as number) > 3) throw new Error('Resposta inválida.');
    normalized[String(id)] = raw as number;
  }
  return normalized;
}

function calculateScores(answers: Record<string, number>) {
  let medo = 0;
  let inseguranca = 0;
  let procrastinacao = 0;
  for (let id = 1; id <= 4; id += 1) medo += answers[String(id)];
  for (let id = 5; id <= 8; id += 1) inseguranca += answers[String(id)];
  for (let id = 9; id <= 12; id += 1) procrastinacao += answers[String(id)];

  // Deterministic tie-breaker: MEDO > INSEGURANÇA > PROCRASTINAÇÃO.
  let dominante = 'MEDO';
  let max = medo;
  if (inseguranca > max) { dominante = 'INSEGURANÇA'; max = inseguranca; }
  if (procrastinacao > max) { dominante = 'PROCRASTINAÇÃO'; }
  return { score_medo: medo, score_inseguranca: inseguranca, score_procrastinacao: procrastinacao, resultado_dominante: dominante };
}

type Quiz = {
  quiz_session_id: string;
  nome: string;
  email: string;
  respostas: Record<string, number>;
  score_medo: number;
  score_inseguranca: number;
  score_procrastinacao: number;
  resultado_dominante: string;
  payment_status: 'pending' | 'paid';
  created_at: string;
  paid_at?: string | null;
  stripe_checkout_session_id?: string | null;
  email_sent_at?: string | null;
};

async function dbRequest<T>(pathName: string, init: RequestInit = {}): Promise<T> {
  if (!supabaseUrl || !supabaseUrl.startsWith('https://') || supabaseUrl.includes('run.app') || supabaseUrl.includes('google.com') || (!supabaseUrl.includes('supabase.co') && !supabaseUrl.includes('supabase.com'))) {
    throw new Error('SUPABASE_URL_INVALID: A variável SUPABASE_URL não parece ser uma URL válida do Supabase. O formato correto é algo como https://xyz.supabase.co.');
  }
  if (!supabaseServiceRoleKey || supabaseServiceRoleKey.length < 50) {
    throw new Error('SUPABASE_URL_INVALID: A chave SUPABASE_SERVICE_ROLE_KEY parece estar incorreta. Ela deve ser um token longo (geralmente começando com eyJ) e não uma senha curta. Vá em Project Settings -> API no Supabase e copie a chave service_role secret.');
  }
  try {
  const response = await fetch(`${supabaseUrl}/rest/v1/${pathName}`, {
    ...init,
    headers: {
      apikey: supabaseServiceRoleKey,
      Authorization: `Bearer ${supabaseServiceRoleKey}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });
  if (!response.ok) {
    const body = await response.text();
    if (response.status === 404 || body.includes('<!DOCTYPE html>')) {
        throw new Error('SUPABASE_URL_INVALID: O banco de dados retornou 404 (Página Não Encontrada). Isso indica que a variável SUPABASE_URL preenchida no painel de configurações (Secrets) está incorreta ou aponta para uma página web, em vez de apontar para a API do Supabase.');
    }
    throw new Error(`Database request failed (${response.status}): ${body.slice(0, 500)}`);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
  } catch (err: any) {
    if (err.message && err.message.includes('fetch failed')) { throw new Error('Falha de conexão com o Supabase. Verifique se a variável SUPABASE_URL está correta.'); }
    throw err;
  }
}

async function insertQuiz(quiz: Quiz): Promise<void> {
  await dbRequest('quiz_sessions', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(quiz) });
}

async function getQuiz(id: string): Promise<Quiz | null> {
  const rows = await dbRequest<Quiz[]>(`quiz_sessions?quiz_session_id=eq.${encodeURIComponent(id)}&select=*`);
  return rows[0] || null;
}

async function updateQuiz(id: string, patch: Partial<Quiz>): Promise<void> {
  await dbRequest(`quiz_sessions?quiz_session_id=eq.${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify(patch),
  });
}

app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

app.post('/api/quiz', rateLimit(10, 15 * 60 * 1000), async (req, res) => {
  try {
    const nome = normalizeName(req.body?.nome);
    const email = normalizeEmail(req.body?.email);
    const respostas = validateAnswers(req.body?.respostas);
    const scores = calculateScores(respostas);
    const quiz: Quiz = {
      quiz_session_id: uuidv4(),
      nome,
      email,
      respostas,
      ...scores,
      payment_status: 'pending',
      created_at: new Date().toISOString(),
    };
    await insertQuiz(quiz);
    return res.status(201).json({ quiz_session_id: quiz.quiz_session_id });
  } catch (error: any) {
    console.error('Quiz creation error:', error?.message || error);
    if (error?.message?.includes('SUPABASE_URL_INVALID')) { 
      return res.status(500).json({ error: error.message.replace('SUPABASE_URL_INVALID: ', '') }); 
    }
    return res.status(400).json({ error: 'Dados do quiz inválidos.' });
  }
});

app.post('/api/checkout', rateLimit(10, 15 * 60 * 1000), async (req, res) => {
  try {
    const id = typeof req.body?.quiz_session_id === 'string' ? req.body.quiz_session_id : '';
    if (!/^[0-9a-f-]{36}$/i.test(id)) return res.status(400).json({ error: 'Sessão inválida.' });
    const quiz = await getQuiz(id);
    if (!quiz) return res.status(404).json({ error: 'Quiz não encontrado.' });
    if (quiz.payment_status === 'paid') return res.status(409).json({ error: 'Este resultado já foi pago.' });

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card', 'pix'],
      payment_method_options: { card: { installments: { enabled: true } } },
      line_items: [{ price: stripePriceId, quantity: 1 }],
      mode: 'payment',
      success_url: `${appUrl}/resultado?session_id=${encodeURIComponent(id)}`,
      cancel_url: `${appUrl}/paywall?session_id=${encodeURIComponent(id)}&canceled=true`,
      client_reference_id: id,
      customer_email: quiz.email,
      metadata: { quiz_session_id: id },
    });

    await updateQuiz(id, { stripe_checkout_session_id: session.id });
    return res.json({ url: session.url });
  } catch (error: any) {
    console.error('Checkout error:', error?.message || error);
    return res.status(502).json({ error: 'Não foi possível iniciar o pagamento.' });
  }
});

app.get('/api/quiz/:id', rateLimit(30, 15 * 60 * 1000), async (req, res) => {
  try {
    const id = req.params.id;
    if (!/^[0-9a-f-]{36}$/i.test(id)) return res.status(400).json({ error: 'Sessão inválida.' });
    const quiz = await getQuiz(id);
    if (!quiz) return res.status(404).json({ error: 'Quiz não encontrado.' });

    if (quiz.payment_status !== 'paid') {
      return res.json({ quiz_session_id: quiz.quiz_session_id, nome: quiz.nome, payment_status: 'pending' });
    }

    // Only expose the minimum data needed by the result screen. Raw email and answers are not returned.
    return res.json({
      quiz_session_id: quiz.quiz_session_id,
      nome: quiz.nome,
      resultado_dominante: quiz.resultado_dominante,
      score_medo: quiz.score_medo,
      score_inseguranca: quiz.score_inseguranca,
      score_procrastinacao: quiz.score_procrastinacao,
      payment_status: quiz.payment_status,
      paid_at: quiz.paid_at,
    });
  } catch (error: any) {
    console.error('Result retrieval error:', error?.message || error);
    return res.status(500).json({ error: 'Não foi possível carregar o resultado.' });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'spa' });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => res.sendFile(path.join(distPath, 'index.html')));
  }

  app.listen(PORT, '0.0.0.0', () => console.log(`Server running on port ${PORT}`));
}

startServer().catch(error => {
  console.error('Server startup failed:', error);
  process.exit(1);
});
