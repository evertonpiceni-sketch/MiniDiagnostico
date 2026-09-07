const fs = require('fs');

const files = [
  'src/App.tsx', 'src/main.tsx', 'src/index.css', 'src/final-approved-layout.css', 'src/landing-v2.css', 'index.html',
  'api/checkout.ts', 'api/asaas-pix.ts', 'api/asaas-webhook.ts',
  'api/quiz.ts', 'api/quiz/[id]/verify-payment.ts', 'api/diagnostico-pdf.ts',
  'package.json', 'vercel.json', '.env.example'
];
const sources = files.map(file => [file, fs.readFileSync(file, 'utf8')]);
const app = sources.find(([file]) => file === 'src/App.tsx')[1];
const main = sources.find(([file]) => file === 'src/main.tsx')[1];
const landing = sources.find(([file]) => file === 'src/landing-v2.css')[1];
const all = sources.map(([, source]) => source).join('\n');

for (const fragment of [
  'Descubra o que está te impedindo de avançar',
  'Você sabe que quer mudar alguma coisa.',
  'Responda a 12 perguntas rápidas e descubra qual padrão pode estar agindo por trás dessa trava',
  'Seu resultado pode revelar mais do que você imagina.',
  '2 minutos',
  'Seus dados estão seguros e protegidos.',
  'R$ 9,90', 'WhatsApp', '/api/checkout', '/api/asaas-pix', 'CREDIT_CARD', 'PIX', 'RESULT_TOKEN_SECRET',
  '/ja-logo.webp', '/hero-golden-woman.webp', 'Resultado confidencial', 'Asaas'
]) {
  if (!all.includes(fragment)) throw new Error(`Production guard failed: missing fragment: ${fragment}`);
}

for (const fragment of [
  'checkout.stripe.com', 'js.stripe.com', 'stripe-buy-button', 'stripe-pricing-table',
  'STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', 'STRIPE_PRICE_ID', "from 'stripe'",
  'btn-pagar-cartao-stripe', "localStorage.setItem('janaina_resultado'", 'checkout_session_id',
  'stripe_checkout_session_id', 'brand-start-card', 'brand-hero-art'
]) {
  if (all.includes(fragment)) throw new Error(`Production guard failed: forbidden legacy fragment: ${fragment}`);
}

if (app.includes('<small>5 minutos</small>')) throw new Error('Production guard failed: approved duration is 2 minutos');
if (!app.includes('className="landing-v2"')) throw new Error('Production guard failed: landing v2 component missing');
if (!landing.includes("/hero-golden-woman.webp")) throw new Error('Production guard failed: approved hero asset is not referenced by landing-v2.css');
if (!main.includes("import './landing-v2.css';")) throw new Error('Production guard failed: landing-v2.css is not loaded');
if (!landing.includes('.landing-v2__visual')) throw new Error('Production guard failed: isolated hero styling missing');

console.log('Production guard passed: approved landing hero, Janaína identity, Asaas-only payments, R$ 9,90 and protected result flow.');
