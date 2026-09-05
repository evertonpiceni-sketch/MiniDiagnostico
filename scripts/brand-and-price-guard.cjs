const fs = require('fs');

const appPath = 'src/App.tsx';
let code = fs.readFileSync(appPath, 'utf8');

// Approved brand language: avoid therapeutic/cure promises.
code = code.replace(/cura/gi, 'caminho de volta pra si');

// Keep the displayed price explicit wherever it is rendered in the app.
code = code.replace(/R\$\s*47(?:[,.]00)?/g, 'R$ 9,90');

// Keep the landing copy exactly aligned with the approved visual preview.
code = code.replace(
  /Descubra o que está bloqueando o seu bem-estar emocional/g,
  'Descubra o que está te impedindo de avançar',
);
code = code.replace(
  /Responda a 12 perguntas e receba um relatório personalizado com a sua principal área de atenção emocional: medo, insegurança ou procrastinação\./g,
  'Você sabe que quer mudar alguma coisa. Talvez até saiba o que precisa fazer. Mas, na hora de avançar, algo acontece.\n\nResponda a 12 perguntas rápidas e descubra qual padrão pode estar agindo por trás dessa trava — muitas vezes sem que você perceba.\n\nSeu resultado pode revelar mais do que você imagina.',
);

// The production backend identifies and delivers the diagnosis by WhatsApp.
// Keep the frontend contract aligned with /api/quiz so the 12th answer can be saved.
code = code.replace("const [email, setEmail] = useState('');", "const [whatsapp, setWhatsapp] = useState('');");
code = code.replace('if (nome && email) {', "if (nome && whatsapp.replace(/\\D/g, '').length >= 10) {");
code = code.replace('nome, email, respostas: finalRespostas,', 'nome, whatsapp, respostas: finalRespostas,');
code = code.replace('>E-mail</label>', '>WhatsApp</label>');
code = code.replace(
  'type="email" value={email} onChange={e => setEmail(e.target.value)}',
  'type="tel" inputMode="tel" autoComplete="tel" value={whatsapp} onChange={e => setWhatsapp(e.target.value)}',
);
code = code.replace('placeholder="seu@email.com"', 'placeholder="(11) 99999-9999"');

// Keep both payment choices visible in production. Pix remains the existing
// flow; card payments continue through the official Stripe Checkout.
code = code.replace(
  'className={`hidden flex-1 items-center justify-center gap-2 py-3 px-3 rounded-lg text-sm font-bold transition-all cursor-pointer ${',
  'className={`flex-1 flex items-center justify-center gap-2 py-3 px-3 rounded-lg text-sm font-bold transition-all cursor-pointer ${',
);
code = code.replace("{false && activePaymentTab === 'pix' && (", "{activePaymentTab === 'pix' && (");

// Fail the build instead of silently publishing a frontend/backend contract mismatch.
const requiredFragments = [
  "const [whatsapp, setWhatsapp] = useState('');",
  "if (nome && whatsapp.replace(/\\D/g, '').length >= 10) {",
  'nome, whatsapp, respostas: finalRespostas,',
  '>WhatsApp</label>',
  'type="tel" inputMode="tel" autoComplete="tel" value={whatsapp}',
  "{activePaymentTab === 'pix' && (",
  'id="btn-pagar-cartao-stripe"',
  'Descubra o que está te impedindo de avançar',
  'Seu resultado pode revelar mais do que você imagina.',
];

for (const fragment of requiredFragments) {
  if (!code.includes(fragment)) {
    throw new Error(`Production guard failed: missing fragment: ${fragment}`);
  }
}

if (code.includes("const [email, setEmail] = useState('');") || code.includes('nome, email, respostas: finalRespostas,')) {
  throw new Error('Cadastro WhatsApp guard failed: legacy email flow is still active.');
}

if (code.includes("{false && activePaymentTab === 'pix' && (")) {
  throw new Error('Payment guard failed: Pix is still disabled.');
}

fs.writeFileSync(appPath, code);
console.log('Production guards applied: copy final / R$ 9,90 / WhatsApp / Pix + card visible');
