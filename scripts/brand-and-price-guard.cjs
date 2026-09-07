const fs = require('fs');

const files = [
  'src/App.tsx', 'src/main.tsx', 'index.html',
  'api/checkout.ts', 'api/asaas-pix.ts', 'api/asaas-webhook.ts',
  'api/quiz.ts', 'api/quiz/[id]/verify-payment.ts', 'api/diagnostico-pdf.ts',
  'package.json', 'vercel.json', '.env.example'
];
const sources = files.map(file => [file, fs.readFileSync(file, 'utf8')]);
const app = sources.find(([file]) => file === 'src/App.tsx')[1];
const all = sources.map(([, source]) => source).join('\n');

for (const fragment of ['Descubra o que está bloqueando o seu bem-estar emocional','R$ 9,90','WhatsApp','/api/checkout','/api/asaas-pix','CREDIT_CARD','PIX','RESULT_TOKEN_SECRET']) {
  if (!all.includes(fragment)) throw new Error(`Production guard failed: missing fragment: ${fragment}`);
}
for (const fragment of ['checkout.stripe.com','js.stripe.com','stripe-buy-button','stripe-pricing-table','STRIPE_SECRET_KEY','STRIPE_WEBHOOK_SECRET','STRIPE_PRICE_ID',"from 'stripe'",'btn-pagar-cartao-stripe',"localStorage.setItem('janaina_resultado'",'checkout_session_id','stripe_checkout_session_id']) {
  if (all.includes(fragment)) throw new Error(`Production guard failed: forbidden legacy fragment: ${fragment}`);
}
if (/<nav\b/i.test(app)) throw new Error('Production guard failed: obsolete navigation must stay removed');
if (app.includes('<small>5 minutos</small>')) throw new Error('Production guard failed: approved duration is 2 minutos');
if (!app.includes('Resultado confidencial')) throw new Error('Production guard failed: pending result must remain confidential');
console.log('Production guard passed: Asaas-only, R$ 9,90, server-side payment verification, confidential pending result, approved landing constraints.');
