const fs = require('fs');

const appPath = 'src/App.tsx';
const mainPath = 'src/main.tsx';
const cssPath = 'src/final-approved-layout.css';

const app = fs.readFileSync(appPath, 'utf8');
const main = fs.readFileSync(mainPath, 'utf8');
const css = fs.readFileSync(cssPath, 'utf8');

const requiredApp = [
  "const [whatsapp, setWhatsapp] = useState('');",
  'Descubra o que está bloqueando o seu bem-estar emocional',
  'R$ 9,90',
  'id="btn-pagar-cartao-asaas"',
  "{activePaymentTab === 'pix' && (",
  'QUERO APROFUNDAR MEU DIAGNÓSTICO',
];
for (const fragment of requiredApp) {
  if (!app.includes(fragment)) throw new Error(`Production guard failed: missing App fragment: ${fragment}`);
}
if (app.includes("localStorage.setItem('janaina_resultado'")) throw new Error('Production guard failed: diagnosis must not be persisted before payment');
if (app.includes('Pagamento protegido pela Stripe') || app.includes('btn-pagar-cartao-stripe')) throw new Error('Production guard failed: legacy Stripe UI remains');
if (app.includes('className="preview-nav"')) throw new Error('Production guard failed: legacy navigation remains');
if (main.includes("'./responsive.css'") || main.includes("'./reference-layout.css'")) throw new Error('Production guard failed: legacy visual CSS is still imported');
if (!main.includes("'./final-approved-layout.css'")) throw new Error('Production guard failed: approved layout CSS is not imported');
if (!css.includes('.preview-nav,.preview-nav-link,.preview-nav-cta{display:none!important}')) throw new Error('Production guard failed: approved layout does not explicitly suppress legacy navigation');

console.log('Production guards verified: menu-free approved layout / R$ 9,90 / WhatsApp / protected result / Asaas Pix + credit');
