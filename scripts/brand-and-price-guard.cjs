const fs = require('fs');

const files = [
  'src/App.tsx', 'src/main.tsx', 'src/index.css', 'src/brand-system.css', 'src/result-clean-final.css', 'src/result-enhancer.ts', 'src/result-content.ts', 'src/ambient-audio.ts',
  'api/checkout.ts', 'api/asaas-pix.ts', 'api/asaas-webhook.ts', 'api/quiz.ts',
  'api/quiz/[id].ts', 'api/quiz/[id]/verify-payment.ts', 'api/diagnostico-pdf.ts',
  'api/quiz/[id]/recover-access.ts',
  'index.html', 'package.json', 'vite.config.ts', 'vercel.json', '.env.example',
];
const sources = files.map(file => [file, fs.readFileSync(file, 'utf8')]);
const all = sources.map(([, source]) => source).join('\n');
const app = sources.find(([file]) => file === 'src/App.tsx')[1];
const main = sources.find(([file]) => file === 'src/main.tsx')[1];

for (const fragment of [
  'Descubra o que está bloqueando o seu bem-estar emocional', 'Responda a 12 perguntas',
  '2 minutos', 'Seus dados estão seguros e protegidos.', 'R$ 9,90',
  'WhatsApp', '/api/checkout', '/api/asaas-pix', 'CREDIT_CARD', 'PIX',
  'RESULT_TOKEN_SECRET', '/ja-logo-approved.webp', 'result-clean-final.css',
  '/result-assets/medo-hero-clean.jpg', 'Asaas', 'resultado_dominante',
  '/recover-access', '5521983928113', 'instagram.com/eujanainaaraujo',
  'landing-instagram-link', 'viewBox="0 0 24 24"',
  'O medo nem sempre impede você de querer avançar.',
]) if (!all.includes(fragment)) throw new Error(`Production guard failed: missing fragment: ${fragment}`);

const forbiddenPaymentProvider = ['str', 'ipe'].join('');
for (const fragment of [
  forbiddenPaymentProvider, 'R$ 47', '47.00', '47.0', "localStorage.setItem('janaina_resultado'",
  'checkout_session_id', [forbiddenPaymentProvider, '_checkout_session_id'].join(''), 'landing-v2.css',
  'final-approved-layout.css', 'VitePWA(', ['vite-plugin-', 'pwa'].join(''),
]) if (all.toLowerCase().includes(fragment.toLowerCase())) throw new Error(`Production guard failed: forbidden legacy fragment: ${fragment}`);

if (app.includes("currentStep === 'preview'") || app.includes('previewResult')) throw new Error('Production guard failed: unpaid result preview is exposed');
if (app.includes('approved-landing__top-cta')) throw new Error('Production guard failed: detached top start button returned');
if (!app.includes("setCurrentStep('paywall')") || !app.includes('Ir para pagamento')) throw new Error('Production guard failed: quiz must go directly to payment');
if (/json\([^)]*resultado_dominante/.test(sources.find(([file]) => file === 'api/quiz.ts')[1])) throw new Error('Production guard failed: quiz API exposes unpaid result');
if (!app.includes('showLeadForm')) throw new Error('Production guard failed: lead form modal missing');
if (!main.includes("import './brand-system.css';")) throw new Error('Production guard failed: unified brand stylesheet missing');
if (!main.includes("import './result-clean-final.css';")) throw new Error('Production guard failed: isolated final result stylesheet missing');
if (main.includes("import './exact-reference.css';") || main.includes("import './final-approved-layout.css';")) throw new Error('Production guard failed: legacy result stylesheet reactivated');

for (const [file, minBytes, magic] of [
  ['public/landing-approved-reference.webp', 100_000, 'WEBP'],
  ['public/ja-logo-approved.webp', 3_000, 'WEBP'],
]) {
  const asset = fs.readFileSync(file);
  if (asset.length < minBytes || asset.subarray(0, 4).toString('ascii') !== 'RIFF' || asset.subarray(8, 12).toString('ascii') !== magic) {
    throw new Error(`Production guard failed: corrupt asset: ${file}`);
  }
}

const medoHero = fs.readFileSync('public/result-assets/medo-hero-clean.jpg');
const isJpeg = medoHero.length > 4 && medoHero[0] === 0xff && medoHero[1] === 0xd8 && medoHero[medoHero.length - 2] === 0xff && medoHero[medoHero.length - 1] === 0xd9;
if (!isJpeg) {
  throw new Error('Production guard failed: invalid JPEG structure: public/result-assets/medo-hero-clean.jpg');
}

console.log('Production guard passed: approved identity, isolated final result layer, canonical result content, clean MEDO hero, Asaas-only payments, R$ 9,90, protected result and valid assets.');
