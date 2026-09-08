const fs = require('fs');

const appPath = 'src/App.tsx';
let code = fs.readFileSync(appPath, 'utf8');

// Keep the final approved Janaína identity and wording stable at build time.
code = code
  .replaceAll('src="/logo.jpg"', 'src="/ja-logo.webp"')
  .replaceAll('src="/logo.svg"', 'src="/ja-logo.webp"')
  .replace(
    'Responda a 12 perguntas e receba um relatório personalizado sobre a principal área de atenção percebida nas suas respostas.',
    'Responda a 12 perguntas e descubra qual área merece mais atenção neste momento: medo, insegurança ou procrastinação.'
  )
  .replace(
    'Mini Diagnóstico Emocional • Relatório completo + orientações •',
    'Mini Diagnóstico Emocional • Relatório completo + orientações terapêuticas •'
  )
  .replaceAll('GERAR PIX — R$ 9,90', 'Gerar PIX — R$ 9,90')
  .replaceAll('CONCLUIR PAGAMENTO — R$ 9,90', 'Concluir pagamento — R$ 9,90');

fs.writeFileSync(appPath, code);

const files = [
  'src/App.tsx', 'src/main.tsx', 'index.html',
  'api/checkout.ts', 'api/asaas-pix.ts', 'api/asaas-webhook.ts',
  'api/quiz.ts', 'api/quiz/[id]/verify-payment.ts', 'api/diagnostico-pdf.ts',
  'package.json', 'vercel.json', '.env.example'
];
const sources = files.map(file => [file, fs.readFileSync(file, 'utf8')]);
const app = sources.find(([file]) => file === 'src/App.tsx')[1];
const all = sources.map(([, source]) => source).join('\n');

for (const fragment of [
  'Descubra o que está bloqueando o seu bem-estar emocional',
  'Responda a 12 perguntas e descubra qual área merece mais atenção neste momento: medo, insegurança ou procrastinação.',
  'R$ 9,90','WhatsApp','/api/checkout','/api/asaas-pix','CREDIT_CARD','PIX','RESULT_TOKEN_SECRET',
  '/ja-logo.webp','Resultado confidencial','orientações terapêuticas'
]) {
  if (!all.includes(fragment)) throw new Error(`Production guard failed: missing fragment: ${fragment}`);
}
for (const fragment of ['checkout.stripe.com','js.stripe.com','stripe-buy-button','stripe-pricing-table','STRIPE_SECRET_KEY','STRIPE_WEBHOOK_SECRET','STRIPE_PRICE_ID',"from 'stripe'",'btn-pagar-cartao-stripe',"localStorage.setItem('janaina_resultado'",'checkout_session_id','stripe_checkout_session_id']) {
  if (all.includes(fragment)) throw new Error(`Production guard failed: forbidden legacy fragment: ${fragment}`);
}
if (/<nav\b/i.test(app)) throw new Error('Production guard failed: obsolete navigation must stay removed');
if (app.includes('<small>5 minutos</small>')) throw new Error('Production guard failed: approved duration is 2 minutos');
console.log('Production guard passed: approved Janaína identity/copy, Asaas-only, R$ 9,90, confidential result and final CTA wording.');
