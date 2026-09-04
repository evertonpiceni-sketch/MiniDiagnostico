const fs = require('fs');

const appPath = 'src/App.tsx';
let code = fs.readFileSync(appPath, 'utf8');

// Approved brand language: avoid therapeutic/cure promises.
code = code.replace(/cura/gi, 'caminho de volta pra si');

// Keep the displayed price explicit wherever it is rendered in the app.
code = code.replace(/R\$\s*47(?:[,.]00)?/g, 'R$ 9,90');

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

// Fail the build instead of silently publishing a frontend/backend contract mismatch.
const requiredFragments = [
  "const [whatsapp, setWhatsapp] = useState('');",
  "if (nome && whatsapp.replace(/\\D/g, '').length >= 10) {",
  'nome, whatsapp, respostas: finalRespostas,',
  '>WhatsApp</label>',
  'type="tel" inputMode="tel" autoComplete="tel" value={whatsapp}',
];

for (const fragment of requiredFragments) {
  if (!code.includes(fragment)) {
    throw new Error(`Cadastro WhatsApp guard failed: missing fragment: ${fragment}`);
  }
}

if (code.includes("const [email, setEmail] = useState('');") || code.includes('nome, email, respostas: finalRespostas,')) {
  throw new Error('Cadastro WhatsApp guard failed: legacy email flow is still active.');
}

fs.writeFileSync(appPath, code);
console.log('Brand, price and WhatsApp guards applied: R$ 9,90 / cadastro aligned with /api/quiz');
