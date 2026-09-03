import 'dotenv/config';
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
  if (!value) throw new Error(`${name} must be configured.`);
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
const resend = process.env.RESEND_API_KEY?.trim() ? new Resend(process.env.RESEND_API_KEY.trim()) : null;

if (stripeSecretKey.startsWith('sk_test_') && isProduction) {
  console.warn('Stripe is using a test key while NODE_ENV=production. Configure the live key before launch.');
}

const allowedOrigins = new Set(
  corsOrigin
    .split(',')
    .map(origin => origin.trim().replace(/\/$/, ''))
    .filter(Boolean),
);

app.disable('x-powered-by');
app.set('trust proxy', 1);

app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.has(origin.replace(/\/$/, ''))) return callback(null, true);
    return callback(new Error('Origin not allowed by CORS'));
  },
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type'],
  credentials: false,
}));

app.use((req, res, next) => {
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  if (isProduction) res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  if (req.path.startsWith('/api/')) res.setHeader('Cache-Control', 'no-store');
  next();
});

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

const quizIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

  let dominante = 'MEDO';
  let max = medo;
  if (inseguranca > max) { dominante = 'INSEGURANÇA'; max = inseguranca; }
  if (procrastinacao > max) dominante = 'PROCRASTINAÇÃO';

  return {
    score_medo: medo,
    score_inseguranca: inseguranca,
    score_procrastinacao: procrastinacao,
    resultado_dominante: dominante,
  };
}

async function dbRequest<T>(pathName: string, init: RequestInit = {}): Promise<T> {
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
    throw new Error(`Database request failed (${response.status}): ${body.slice(0, 500)}`);
  }

  const text = (await response.text()).trim();
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
}

async function insertQuiz(quiz: Quiz): Promise<void> {
  await dbRequest('quiz_sessions', {
    method: 'POST',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify(quiz),
  });
}

async function getQuiz(id: string): Promise<Quiz | null> {
  const rows = await dbRequest<Quiz[]>(`quiz_sessions?quiz_session_id=eq.${encodeURIComponent(id)}&select=*`);
  return rows?.[0] || null;
}

async function updateQuiz(id: string, patch: Partial<Quiz>): Promise<void> {
  await dbRequest(`quiz_sessions?quiz_session_id=eq.${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify(patch),
  });
}

async function sendResultEmail(quiz: Quiz): Promise<void> {
  if (!resend || quiz.payment_status !== 'paid' || quiz.email_sent_at || !quiz.email) return;

  const link = `${appUrl}/resultado?session_id=${encodeURIComponent(quiz.quiz_session_id)}`;
  const safeName = escapeHtml(quiz.nome || 'visitante');
  const safeDominant = escapeHtml(quiz.resultado_dominante);

  try {
    await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL?.trim() || 'Mini Diagnóstico <onboarding@resend.dev>',
      to: quiz.email,
      subject: `${quiz.nome ? `${quiz.nome}, seu` : 'Seu'} Mini Diagnóstico está pronto!`,
      html: `
        <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1c1917;max-width:600px;margin:0 auto;padding:24px;border:1px solid #e7e5e4;border-radius:16px;background:#fff">
          <h2 style="color:#065f46;margin-top:0">Olá, ${safeName}!</h2>
          <p>Seu pagamento foi confirmado e o seu <strong>Mini Diagnóstico Completo</strong> já está disponível.</p>
          <div style="background:#f0fdf4;border:1px solid #bbf7d0;padding:20px;border-radius:12px;margin:24px 0">
            <p><strong>Padrão Dominante Identificado:</strong></p>
            <p style="font-size:22px;font-weight:bold;color:#047857">${safeDominant}</p>
            <ul style="list-style:none;padding:0">
              <li>• Nível de Medo: <strong>${quiz.score_medo} / 12</strong></li>
              <li>• Nível de Insegurança: <strong>${quiz.score_inseguranca} / 12</strong></li>
              <li>• Nível de Procrastinação: <strong>${quiz.score_procrastinacao} / 12</strong></li>
            </ul>
          </div>
          <div style="text-align:center;margin:32px 0">
            <a href="${link}" style="background:#059669;color:#fff;padding:14px 32px;text-decoration:none;border-radius:10px;font-weight:bold">Ver Diagnóstico Completo</a>
          </div>
          <p style="font-size:13px;color:#78716c">Se o botão não funcionar, copie este link:<br><a href="${link}">${link}</a></p>
          <p style="font-size:14px;color:#78716c">Equipe Mini Diagnóstico • Janaína Araújo</p>
        </div>
      `,
    });

    const sentAt = new Date().toISOString();
    await updateQuiz(quiz.quiz_session_id, { email_sent_at: sentAt });
    quiz.email_sent_at = sentAt;
  } catch (error) {
    console.error('Email delivery failed:', error);
  }
}

async function confirmStripeSession(quiz: Quiz, session: Stripe.Checkout.Session): Promise<boolean> {
  const linkedQuizId = session.metadata?.quiz_session_id || session.client_reference_id;

  if (linkedQuizId !== quiz.quiz_session_id || session.payment_status !== 'paid') return false;
  if (quiz.stripe_checkout_session_id && quiz.stripe_checkout_session_id !== session.id) return false;

  if (quiz.payment_status !== 'paid') {
    const paidAt = new Date().toISOString();
    await updateQuiz(quiz.quiz_session_id, {
      payment_status: 'paid',
      paid_at: paidAt,
      stripe_checkout_session_id: session.id,
    });
    quiz.payment_status = 'paid';
    quiz.paid_at = paidAt;
    quiz.stripe_checkout_session_id = session.id;
  }

  await sendResultEmail(quiz);
  return true;
}

// Stripe requires the raw request body for signature verification. Keep this route before express.json().
app.post('/api/webhook', express.raw({ type: 'application/json', limit: '256kb' }), async (req, res) => {
  const signature = req.headers['stripe-signature'];
  if (typeof signature !== 'string') return res.status(400).json({ error: 'Assinatura Stripe ausente.' });

  try {
    const event = stripe.webhooks.constructEvent(req.body, signature, stripeWebhookSecret);

    if (event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') {
      const session = event.data.object as Stripe.Checkout.Session;
      const quizSessionId = session.metadata?.quiz_session_id || session.client_reference_id;

      if (quizSessionId && quizIdPattern.test(quizSessionId)) {
        const quiz = await getQuiz(quizSessionId);
        if (quiz) await confirmStripeSession(quiz, session);
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

    if (current.count >= max) {
      res.setHeader('Retry-After', Math.max(1, Math.ceil((current.resetAt - now) / 1000)));
      return res.status(429).json({ error: 'Muitas requisições. Tente novamente mais tarde.' });
    }

    current.count += 1;
    return next();
  };
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
    return res.status(400).json({ error: 'Dados do quiz inválidos.' });
  }
});

app.post('/api/checkout', rateLimit(10, 15 * 60 * 1000), async (req, res) => {
  try {
    const id = typeof req.body?.quiz_session_id === 'string' ? req.body.quiz_session_id : '';
    if (!quizIdPattern.test(id)) return res.status(400).json({ error: 'Sessão inválida.' });

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

    if (!session.url) return res.status(502).json({ error: 'Stripe não retornou uma URL de pagamento.' });

    await updateQuiz(id, { stripe_checkout_session_id: session.id });
    return res.json({ url: session.url });
  } catch (error: any) {
    console.error('Checkout error:', error?.message || error);
    return res.status(502).json({ error: 'Não foi possível iniciar o pagamento.' });
  }
});

// Safe fallback for the short delay between Stripe redirect and webhook delivery.
// This endpoint never accepts manual PIX confirmation and never searches payments by email.
app.post('/api/quiz/:id/verify-payment', rateLimit(60, 15 * 60 * 1000), async (req, res) => {
  try {
    const id = req.params.id;
    if (!quizIdPattern.test(id)) return res.status(400).json({ error: 'Sessão inválida.' });

    const quiz = await getQuiz(id);
    if (!quiz) return res.status(404).json({ error: 'Quiz não encontrado.' });

    if (quiz.payment_status === 'paid') {
      await sendResultEmail(quiz);
      return res.json({ payment_status: 'paid' });
    }

    if (!quiz.stripe_checkout_session_id || !quiz.stripe_checkout_session_id.startsWith('cs_')) {
      return res.json({ payment_status: 'pending' });
    }

    const session = await stripe.checkout.sessions.retrieve(quiz.stripe_checkout_session_id);
    const confirmed = await confirmStripeSession(quiz, session);
    return res.json({ payment_status: confirmed ? 'paid' : 'pending' });
  } catch (error: any) {
    console.error('Verify payment error:', error?.message || error);
    return res.status(500).json({ error: 'Erro ao verificar pagamento.' });
  }
});

app.get('/api/quiz/:id', rateLimit(60, 15 * 60 * 1000), async (req, res) => {
  try {
    const id = req.params.id;
    if (!quizIdPattern.test(id)) return res.status(400).json({ error: 'Sessão inválida.' });

    const quiz = await getQuiz(id);
    if (!quiz) return res.status(404).json({ error: 'Quiz não encontrado.' });

    if (quiz.payment_status !== 'paid') {
      return res.json({
        quiz_session_id: quiz.quiz_session_id,
        nome: quiz.nome,
        payment_status: 'pending',
      });
    }

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
  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'spa' });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath, { maxAge: '1h' }));
    app.get('*', (_req, res) => res.sendFile(path.join(distPath, 'index.html')));
  }

  app.listen(PORT, '0.0.0.0', () => console.log(`Server running on port ${PORT}`));
}

startServer().catch(error => {
  console.error('Server startup failed:', error);
  process.exit(1);
});
