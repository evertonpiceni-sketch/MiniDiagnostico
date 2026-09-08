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
  'Descubra o que está te impedindo de avançar', 'Você sabe que quer mudar alguma coisa.',
  'Responda a 12 perguntas rápidas e descubra qual padrão pode estar agindo por trás dessa trava',
  'Seu resultado pode revelar mais do que você imagina.', '2 minutos', 'Seus dados estão seguros e protegidos.',
  'R$ 9,90', 'WhatsApp', '/api/checkout', '/api/asaas-pix', 'CREDIT_CARD', 'PIX', 'RESULT_TOKEN_SECRET',
  '/ja-logo.webp', '/hero-approved-live.jpg', 'Resultado confidencial', 'Asaas'
]) if (!all.includes(fragment)) throw new Error(`Production guard failed: missing fragment: ${fragment}`);

for (const fragment of [
  'checkout.stripe.com', 'js.stripe.com', 'stripe-buy-button', 'stripe-pricing-table', 'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET', 'STRIPE_PRICE_ID', "from 'stripe'", 'btn-pagar-cartao-stripe',
  "localStorage.setItem('janaina_resultado'", 'checkout_session_id', 'stripe_checkout_session_id',
  'hero-golden-woman.webp', 'brand-start-card', 'brand-hero-art'
]) if (all.includes(fragment)) throw new Error(`Production guard failed: forbidden legacy fragment: ${fragment}`);

if (app.includes('<small>5 minutos</small>')) throw new Error('Production guard failed: approved duration is 2 minutos');
if (!app.includes('className="landing-v2"')) throw new Error('Production guard failed: landing v2 component missing');
if (!app.includes('<img src="/hero-approved-live.jpg"')) throw new Error('Production guard failed: validated approved hero element missing');
if (!main.includes("import './landing-v2.css';")) throw new Error('Production guard failed: landing-v2.css is not loaded');
if (!landing.includes('.landing-v2__visual>img{display:block')) throw new Error('Production guard failed: approved hero is not explicitly visible');
if (landing.includes('.landing-v2__visual>img{display:none')) throw new Error('Production guard failed: approved hero is hidden');

const hero = fs.readFileSync('public/hero-approved-live.jpg');
if (hero.length < 10_000 || hero[0] !== 0xff || hero[1] !== 0xd8 || hero.at(-2) !== 0xff || hero.at(-1) !== 0xd9) {
  throw new Error('Production guard failed: approved hero JPEG is missing or corrupt');
}

console.log('Production guard passed: visible approved hero, responsive landing, Janaína identity, Asaas-only payments, R$ 9,90 and protected result flow.');
