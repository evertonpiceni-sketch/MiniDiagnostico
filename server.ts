import express from 'express';
import path from 'path';
import cors from 'cors';
import Stripe from 'stripe';
import { Resend } from 'resend';
import { v4 as uuidv4 } from 'uuid';

const app = express();
const PORT = 3000;

// Dependencies setup
const stripeSecretKey = process.env.STRIPE_SECRET_KEY || 'sk_test_dummy';
const stripe = new Stripe(stripeSecretKey);
const resendApiKey = process.env.RESEND_API_KEY || 're_dummy';
const resend = new Resend(resendApiKey);

app.use(cors());

// Webhook needs raw body, so we separate it
app.post('/api/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET || 'whsec_placeholder';

  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig as string, endpointSecret);
  } catch (err: any) {
    res.status(400).send(`Webhook Error: ${err.message}`);
    return;
  }

  // Handle the event
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const quizSessionId = session.client_reference_id;
    
    if (quizSessionId) {
      // Mark as paid
      const quiz = memoryDb.get(quizSessionId);
      if (quiz) {
        quiz.payment_status = 'paid';
        quiz.paid_at = new Date().toISOString();
        memoryDb.set(quizSessionId, quiz);
        
        // TODO: Send email
        console.log(`Payment confirmed for quiz: ${quizSessionId}. Sending email to ${quiz.email}...`);
        
        try {
            // Placeholder email sending
            /*
            await resend.emails.send({
                from: 'Mini Diagnóstico <onboarding@resend.dev>',
                to: quiz.email,
                subject: 'Seu Mini Diagnóstico está pronto!',
                html: `<p>Aqui está o seu resultado: <strong>${quiz.resultado_dominante}</strong></p>`
            });
            */
            quiz.email_sent_at = new Date().toISOString();
        } catch (e) {
            console.error('Failed to send email:', e);
        }
      }
    }
  }

  res.json({ received: true });
});

// JSON middleware for other routes
app.use(express.json());

// IN-MEMORY DATABASE (Will reset on container restart)
// It is highly recommended to use Firebase Firestore or Cloud SQL for production.
const memoryDb = new Map<string, any>();

app.post('/api/quiz', async (req, res) => {
  const { nome, email, respostas, score_medo, score_inseguranca, score_procrastinacao, resultado_dominante } = req.body;
  
  const quiz_session_id = uuidv4();
  
  const quizData = {
    quiz_session_id,
    nome,
    email,
    respostas,
    score_medo,
    score_inseguranca,
    score_procrastinacao,
    resultado_dominante,
    payment_status: 'pending',
    created_at: new Date().toISOString()
  };
  
  memoryDb.set(quiz_session_id, quizData);
  
  res.json({ quiz_session_id });
});

app.post('/api/checkout', async (req, res) => {
  const { quiz_session_id } = req.body;
  
  const quiz = memoryDb.get(quiz_session_id);
  
  if (!quiz) {
    res.status(404).json({ error: 'Quiz não encontrado' });
    return;
  }
  
  try {
    const origin = process.env.APP_URL || `http://localhost:${PORT}`;
    
    // In production, use the actual Price ID provided by Janaína
    const priceId = process.env.STRIPE_PRICE_ID || ''; 
    
    // Bypass Stripe if no price ID is set (allows testing the result screen for free)
    if (!priceId || priceId === 'price_placeholder') {
      quiz.payment_status = 'paid';
      res.json({ url: `${origin}/resultado?session_id=${quiz_session_id}` });
      return;
    }
    
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card', 'pix'], // Pix is common in Brazil
      payment_method_options: {
        card: {
          installments: {
            enabled: true
          }
        }
      },
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${origin}/resultado?session_id=${quiz_session_id}`,
      cancel_url: `${origin}/paywall?session_id=${quiz_session_id}&canceled=true`,
      client_reference_id: quiz_session_id,
      customer_email: quiz.email,
    });
    
    quiz.stripe_checkout_session_id = session.id;
    
    res.json({ url: session.url });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/quiz/:id', async (req, res) => {
  const quiz = memoryDb.get(req.params.id);
  
  if (!quiz) {
    res.status(404).json({ error: 'Quiz não encontrado' });
    return;
  }
  
  // Only return sensitive data if paid
  if (quiz.payment_status === 'paid') {
      res.json(quiz);
  } else {
      // Return safe version
      res.json({
          quiz_session_id: quiz.quiz_session_id,
          nome: quiz.nome,
          payment_status: quiz.payment_status
      });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
