const fs = require('fs');

const appPath = 'src/App.tsx';
let code = fs.readFileSync(appPath, 'utf8');

// Approved brand language: avoid therapeutic/cure promises.
code = code.replace(/cura/gi, 'caminho de volta pra si');

// Keep the displayed price explicit wherever it is rendered in the app.
code = code.replace(/R\$\s*47(?:[,.]00)?/g, 'R$ 9,90');

// The production backend identifies and delivers the diagnosis by WhatsApp.
code = code.replace("const [email, setEmail] = useState('');", "const [whatsapp, setWhatsapp] = useState('');");
code = code.replace('if (nome && email) {', "if (nome && whatsapp.replace(/\\D/g, '').length >= 10) {");
code = code.replace('nome, email, respostas: finalRespostas,', 'nome, whatsapp, respostas: finalRespostas,');
code = code.replace('>E-mail</label>', '>WhatsApp</label>');
code = code.replace(
  'type="email" value={email} onChange={e => setEmail(e.target.value)}',
  'type="tel" inputMode="tel" autoComplete="tel" value={whatsapp} onChange={e => setWhatsapp(e.target.value)}',
);
code = code.replace('placeholder="seu@email.com"', 'placeholder="(11) 99999-9999"');

// Exact approved headline and copy.
code = code.replace(/Descubra o que est[aá] bloqueando o seu bem-estar emocional/g, 'Descubra o que está te impedindo de avançar');
code = code.replace(/Responda a 12 perguntas e receba um relat[oó]rio personalizado com a sua principal [aá]rea de aten[cç][aã]o emocional: medo, inseguran[cç]a ou procrastina[cç][aã]o\./g,
  'Você sabe que quer mudar alguma coisa. Talvez até saiba o que precisa fazer. Mas, na hora de avançar, algo acontece. Responda a 12 perguntas rápidas e descubra qual padrão pode estar agindo por trás dessa trava — muitas vezes sem que você perceba. Seu resultado pode revelar mais do que você imagina.'
);

// Add the navigation from the approved preview once.
if (!code.includes('className="preview-nav"')) {
  code = code.replace(
    '<div className="brand-hero-art" aria-hidden="true" />',
    '<nav className="preview-nav" aria-label="Navegação principal"><a href="#inicio">Início</a><a href="#sobre">Sobre</a><a href="#beneficios">Benefícios</a><a href="#faq">FAQ</a><a href="#cadastro" className="preview-nav-cta">Começar</a></nav><div className="brand-hero-art" aria-hidden="true" />'
  );
}

// Keep the home visually identical to the preview: a single CTA first, then reveal
// the required registration fields only after the visitor chooses to start.
const formPattern = /<form onSubmit=\{handleStart\} className="space-y-4">[\s\S]*?<\/form>/;
const previewCapture = `<details className="lead-capture" id="cadastro">
            <summary>Iniciar meu diagnóstico <ArrowRight className="inline w-4 h-4 ml-1" /></summary>
            <form onSubmit={handleStart} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1 text-stone-700">Nome</label>
                <input required type="text" value={nome} onChange={e => setNome(e.target.value)} className="w-full border border-stone-200 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-teal-700" placeholder="Seu nome" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-stone-700">WhatsApp</label>
                <input required type="tel" inputMode="tel" autoComplete="tel" value={whatsapp} onChange={e => setWhatsapp(e.target.value)} className="w-full border border-stone-200 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-teal-700" placeholder="(51) 99999-9999" />
              </div>
              <button type="submit" className="w-full bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white font-medium py-3 rounded-lg transition-colors mt-4 shadow-md shadow-emerald-900/10 active:scale-[0.98]">
                Continuar <ArrowRight className="inline w-4 h-4 ml-1" />
              </button>
            </form>
          </details>
          <div className="preview-signature"><strong>Janaína Araújo</strong><span>TERAPEUTA INTEGRATIVA</span></div>
          <p className="preview-mantra">O primeiro passo para avançar começa com autoconhecimento.</p>`;
if (formPattern.test(code)) code = code.replace(formPattern, previewCapture);

// Keep both payment choices visible in production.
code = code.replace(
  'className={`hidden flex-1 items-center justify-center gap-2 py-3 px-3 rounded-lg text-sm font-bold transition-all cursor-pointer ${',
  'className={`flex-1 flex items-center justify-center gap-2 py-3 px-3 rounded-lg text-sm font-bold transition-all cursor-pointer ${',
);
code = code.replace("{false && activePaymentTab === 'pix' && (", "{activePaymentTab === 'pix' && (");

const requiredFragments = [
  "const [whatsapp, setWhatsapp] = useState('');",
  "if (nome && whatsapp.replace(/\\D/g, '').length >= 10) {",
  'nome, whatsapp, respostas: finalRespostas,',
  '>WhatsApp</label>',
  'type="tel" inputMode="tel" autoComplete="tel" value={whatsapp}',
  "{activePaymentTab === 'pix' && (",
  'id="btn-pagar-cartao-stripe"',
  'Descubra o que está te impedindo de avançar',
  'className="preview-nav"',
  'className="lead-capture"',
];

for (const fragment of requiredFragments) {
  if (!code.includes(fragment)) throw new Error(`Production guard failed: missing fragment: ${fragment}`);
}

if (code.includes("const [email, setEmail] = useState('');") || code.includes('nome, email, respostas: finalRespostas,')) {
  throw new Error('Cadastro WhatsApp guard failed: legacy email flow is still active.');
}
if (code.includes("{false && activePaymentTab === 'pix' && (")) throw new Error('Payment guard failed: Pix is still disabled.');

fs.writeFileSync(appPath, code);
console.log('Production guards applied: approved preview / R$ 9,90 / WhatsApp / Pix + card');
