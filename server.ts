import express from 'express';
import path from 'path';
import cors from 'cors';
import Stripe from 'stripe';
import { Resend } from 'resend';
import { v4 as uuidv4 } from 'uuid';

const app = express();
const PORT = 3000;
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
const supabaseServiceRoleKey = (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
const appUrl = requiredEnv('APP_URL').replace(/\/$/, '');
const corsOrigin = process.env.CORS_ORIGIN?.trim() || appUrl;
const stripeSecretKey = process.env.STRIPE_SECRET_KEY?.trim() || '';
const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim() || '';
const stripePriceId = process.env.STRIPE_PRICE_ID?.trim() || '';

let stripeClient: Stripe | null = null;
function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY?.trim() || stripeSecretKey;
  if (!key) {
    throw new Error('STRIPE_SECRET_KEY environment variable is required');
  }
  if (!stripeClient) {
    stripeClient = new Stripe(key);
  }
  return stripeClient;
}

let cachedResolvedPriceId: string | null = null;
async function getEffectivePriceId(): Promise<string> {
  if (cachedResolvedPriceId) return cachedResolvedPriceId;
  const rawId = process.env.STRIPE_PRICE_ID?.trim() || stripePriceId || 'price_1U9BtxDi05Nlzxp3p6MVPPNI';
  if (rawId.startsWith('price_')) {
    cachedResolvedPriceId = rawId;
    return rawId;
  }
  // Se for um Product ID (prod_...) resolver o Price ID associado
  try {
    const stripeInstance = getStripe();
    const prices = await stripeInstance.prices.list({ product: rawId, active: true, limit: 10 });
    if (prices.data.length > 0) {
      cachedResolvedPriceId = prices.data[0].id;
      return cachedResolvedPriceId;
    }
  } catch (e: any) {
    console.warn('Erro ao resolver stripe price do produto:', e?.message || e);
  }
  // Fallback garantido para o Price ID ativo da conta
  cachedResolvedPriceId = 'price_1U9BtxDi05Nlzxp3p6MVPPNI';
  return cachedResolvedPriceId;
}

function getResend(): Resend | null {
  const key = process.env.RESEND_API_KEY?.trim();
  return key ? new Resend(key) : null;
}

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
    const stripeInstance = getStripe();
    const event = stripeInstance.webhooks.constructEvent(req.body, signature, stripeWebhookSecret);

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

          const resendInstance = getResend();
          if (resendInstance && quiz.email && process.env.RESEND_FROM_EMAIL?.trim()) {
            try {
              await resendInstance.emails.send({
                from: process.env.RESEND_FROM_EMAIL!.trim(),
                to: quiz.email,
                subject: 'Seu Mini Diagnóstico está pronto!',
                html: `
                  <div style="font-family: sans-serif; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <h2 style="color: #4f46e5;">Olá, ${escapeHtml(String(quiz.nome || ''))}!</h2>
                    <p>Obrigado por completar o seu Mini Diagnóstico. Aqui estão os seus resultados preliminares:</p>
                    <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
                      <p style="font-size: 18px;"><strong>Traço Dominante:</strong> <span style="color: #ea580c; font-weight: bold;">${escapeHtml(String(quiz.resultado_dominante))}</span></p>
                      <ul style="list-style-type: none; padding: 0;">
                        <li style="margin-bottom: 8px;">📊 Nível de Medo: <strong>${quiz.score_medo}</strong>/12</li>
                        <li style="margin-bottom: 8px;">📊 Nível de Insegurança: <strong>${quiz.score_inseguranca}</strong>/12</li>
                        <li style="margin-bottom: 8px;">📊 Nível de Procrastinação: <strong>${quiz.score_procrastinacao}</strong>/12</li>
                      </ul>
                    </div>
                    <p>Você pode acessar seu relatório completo através do link fornecido após o pagamento.</p>
                    <p>Um abraço,<br/>Equipe do Mini Diagnóstico</p>
                  </div>
                `,
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
  if (!supabaseServiceRoleKey || supabaseServiceRoleKey.length < 20) {
    throw new Error('SUPABASE_URL_INVALID: A chave SUPABASE_SERVICE_ROLE_KEY parece estar incorreta. Use uma SUPABASE_SECRET_KEY iniciada por sb_secret_ ou a service_role legada do mesmo projeto.');
  }
  try {
  const response = await fetch(`${supabaseUrl}/rest/v1/${pathName}`, {
    ...init,
    headers: {
      apikey: supabaseServiceRoleKey,
      ...(supabaseServiceRoleKey.startsWith('eyJ') ? { Authorization: `Bearer ${supabaseServiceRoleKey}` } : {}),
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
  const text = (await response.text()).trim();
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
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

    const stripeInstance = getStripe();
    const effectivePriceId = await getEffectivePriceId();
    
    // Configura sessão compatível com Cartão e métodos disponíveis na conta Stripe
    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      line_items: [{ price: effectivePriceId, quantity: 1 }],
      mode: 'payment',
      success_url: `${appUrl}/resultado?session_id=${encodeURIComponent(id)}`,
      cancel_url: `${appUrl}/paywall?session_id=${encodeURIComponent(id)}&canceled=true`,
      client_reference_id: id,
      metadata: { quiz_session_id: id },
    };

    if (quiz.email) {
      sessionParams.customer_email = quiz.email;
    }

    const session = await stripeInstance.checkout.sessions.create(sessionParams);

    await updateQuiz(id, { stripe_checkout_session_id: session.id });
    return res.json({ url: session.url });
  } catch (error: any) {
    console.error('Checkout error:', error?.message || error);
    return res.status(502).json({ error: error?.message || 'Não foi possível iniciar o pagamento.' });
  }
});

app.post('/api/quiz/:id/verify-payment', rateLimit(300, 15 * 60 * 1000), async (req, res) => {
  try {
    const id = req.params.id;
    if (!/^[0-9a-f-]{36}$/i.test(id)) return res.status(400).json({ error: 'Sessão inválida.' });
    const quiz = await getQuiz(id);
    if (!quiz) return res.status(404).json({ error: 'Quiz não encontrado.' });
    
    let isPaid = quiz.payment_status === 'paid';
    
    // Fallback sync checking se não foi marcado como pago via webhook
    if (!isPaid) {
       let foundSession: any = null;
       const stripeKey = process.env.STRIPE_SECRET_KEY?.trim() || stripeSecretKey;
       if (stripeKey) {
         try {
           const stripeInstance = getStripe();
           if (quiz.stripe_checkout_session_id) {
               foundSession = await stripeInstance.checkout.sessions.retrieve(quiz.stripe_checkout_session_id);
           }
         } catch (err) {
           console.warn('Stripe sync check failed:', (err as any)?.message || err);
         }
       }
       
       const linkedQuizId = foundSession?.metadata?.quiz_session_id || foundSession?.client_reference_id;
       if (foundSession && foundSession.payment_status === 'paid' && linkedQuizId === id) {
           await updateQuiz(id, { 
             payment_status: 'paid', 
             paid_at: new Date().toISOString(), 
             stripe_checkout_session_id: foundSession.id
           });
           isPaid = true;
           quiz.payment_status = 'paid';
       }
    }
    
    // Ensure email is sent if paid
    if (isPaid && !quiz.email_sent_at && process.env.RESEND_FROM_EMAIL?.trim()) {
       const resendInstance = getResend();
       if (resendInstance && quiz.email && process.env.RESEND_FROM_EMAIL?.trim()) {
          try {
              const link = `${appUrl}/resultado?session_id=${encodeURIComponent(id)}`;
              const userName = escapeHtml(String(quiz.nome || '').trim());
              await resendInstance.emails.send({
                from: process.env.RESEND_FROM_EMAIL!.trim(),
                to: quiz.email,
                subject: `${userName ? `${userName}, seu` : 'Seu'} Mini Diagnóstico está pronto!`,
                html: `
                  <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1c1917; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e7e5e4; border-radius: 16px; background-color: #ffffff;">
                    <h2 style="color: #065f46; margin-top: 0; font-size: 24px;">Olá, ${userName || 'visitante'}!</h2>
                    <p style="font-size: 16px; line-height: 1.6; color: #44403c;">Seu pagamento foi confirmado com sucesso e o seu <strong>Mini Diagnóstico Completo</strong> já está disponível.</p>
                    
                    <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; padding: 20px; border-radius: 12px; margin: 24px 0;">
                      <p style="font-size: 15px; margin: 0 0 10px 0; color: #166534;"><strong>Padrão Dominante Identificado:</strong></p>
                      <p style="font-size: 22px; font-weight: bold; color: #047857; margin: 0 0 16px 0;">${escapeHtml(String(quiz.resultado_dominante))}</p>
                      
                      <p style="font-size: 14px; font-weight: 600; color: #166534; margin: 16px 0 8px 0;">Detalhamento das Pontuações:</p>
                      <ul style="list-style: none; padding: 0; margin: 0; font-size: 15px; color: #374151;">
                        <li style="padding: 6px 0; border-bottom: 1px solid #dcfce7;">• Nível de Medo: <strong>${quiz.score_medo} / 12</strong></li>
                        <li style="padding: 6px 0; border-bottom: 1px solid #dcfce7;">• Nível de Insegurança: <strong>${quiz.score_inseguranca} / 12</strong></li>
                        <li style="padding: 6px 0;">• Nível de Procrastinação: <strong>${quiz.score_procrastinacao} / 12</strong></li>
                      </ul>
                    </div>
                    
                    <p style="font-size: 16px; line-height: 1.6; color: #44403c;">Clique no botão abaixo para acessar sua análise detalhada e descobrir o primeiro movimento recomendado:</p>
                    
                    <div style="text-align: center; margin: 32px 0;">
                      <a href="${link}" style="background-color: #059669; color: #ffffff; padding: 14px 32px; text-decoration: none; border-radius: 10px; font-weight: bold; font-size: 16px; display: inline-block;">Ver Diagnóstico Completo</a>
                    </div>
                    
                    <p style="font-size: 13px; color: #78716c; line-height: 1.5;">Se o botão acima não funcionar, você pode copiar e colar o seguinte link em seu navegador:<br/><a href="${link}" style="color: #059669;">${link}</a></p>
                    
                    <hr style="border: none; border-top: 1px solid #f5f5f4; margin: 30px 0 20px 0;" />
                    <p style="font-size: 14px; color: #78716c; margin: 0;">Equipe Mini Diagnóstico • Janaína Araújo</p>
                  </div>
                `,
              });
              await updateQuiz(id, { email_sent_at: new Date().toISOString() });
          } catch (emailError) {
              console.error('Email delivery failed:', emailError);
          }
       }
    }
    
    return res.json({ payment_status: isPaid ? 'paid' : 'pending' });
  } catch (error: any) {
    console.error('Verify payment error:', error?.message || error);
    return res.status(500).json({ error: 'Erro ao verificar pagamento.' });
  }
});

app.get('/api/quiz/:id', rateLimit(300, 15 * 60 * 1000), async (req, res) => {
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
