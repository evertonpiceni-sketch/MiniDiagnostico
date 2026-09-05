const fs = require('fs');

const appPath = 'src/App.tsx';
let code = fs.readFileSync(appPath, 'utf8');

// Keep production copy/price/WhatsApp contract stable.
code = code.replace(/R\$\s*47(?:[,.]00)?/g, 'R$ 9,90');
code = code.replace("const [email, setEmail] = useState('');", "const [whatsapp, setWhatsapp] = useState('');");
code = code.replace('if (nome && email) {', "if (nome && whatsapp.replace(/\\D/g, '').length >= 10) {");
code = code.replace('nome, email, respostas: finalRespostas,', 'nome, whatsapp, respostas: finalRespostas,');
code = code.replace('>E-mail</label>', '>WhatsApp</label>');
code = code.replace('type="email" value={email} onChange={e => setEmail(e.target.value)}','type="tel" inputMode="tel" autoComplete="tel" value={whatsapp} onChange={e => setWhatsapp(e.target.value)}');
code = code.replace('placeholder="seu@email.com"', 'placeholder="(51) 99999-9999"');

code = code.replace(/Descubra o que est[aá] bloqueando o seu bem-estar emocional/g, 'Descubra o que está te impedindo de avançar');
code = code.replace(/<p className="text-stone-500 mb-5">Responda a 12 perguntas e receba um relat[oó]rio personalizado com a sua principal [aá]rea de aten[cç][aã]o emocional: medo, inseguran[cç]a ou procrastina[cç][aã]o\.<\/p>/g, `<div className="home-copy-block"><p>Você sabe que quer mudar alguma coisa. Talvez até saiba o que precisa fazer. Mas, na hora de avançar, algo acontece.</p><p>Responda a 12 perguntas rápidas e descubra qual padrão pode estar agindo por trás dessa trava — muitas vezes sem que você perceba.</p><p><strong>Seu resultado pode revelar mais do que você imagina.</strong></p></div>`);

// No distracting menu links on the landing page. Keep only the primary CTA.
code = code.replace(/<nav className="preview-nav"[\s\S]*?<\/nav>/, '<nav className="preview-nav" aria-label="Ação principal"><a href="#cadastro" className="preview-nav-cta">Começar</a></nav>');
if (!code.includes('className="preview-nav"')) {
  code = code.replace('<div className="brand-hero-art" aria-hidden="true" />','<nav className="preview-nav" aria-label="Ação principal"><a href="#cadastro" className="preview-nav-cta">Começar</a></nav><div className="brand-hero-art" aria-hidden="true" />');
}

const formPattern = /<form onSubmit=\{handleStart\} className="space-y-4">[\s\S]*?<\/form>/;
const previewCapture = `<details className="lead-capture" id="cadastro"><summary>Iniciar meu diagnóstico <ArrowRight className="inline w-4 h-4 ml-1" /></summary><form onSubmit={handleStart} className="space-y-4"><div><label>Nome</label><input required type="text" value={nome} onChange={e => setNome(e.target.value)} placeholder="Seu nome" /></div><div><label>WhatsApp</label><input required type="tel" inputMode="tel" autoComplete="tel" value={whatsapp} onChange={e => setWhatsapp(e.target.value)} placeholder="(51) 99999-9999" /></div><button type="submit">Continuar <ArrowRight className="inline w-4 h-4 ml-1" /></button></form></details><div className="preview-signature"><strong>Janaína Araújo</strong><span>TERAPEUTA INTEGRATIVA</span></div><a className="preview-instagram" href="https://www.instagram.com/eujanainaaraujo/" target="_blank" rel="noreferrer" aria-label="Instagram de Janaína Araújo">Instagram&nbsp; @eujanainaaraujo</a><p className="preview-mantra">O primeiro passo para avançar começa com autoconhecimento.</p>`;
if (formPattern.test(code)) code = code.replace(formPattern, previewCapture);

code = code.replace("localStorage.setItem('janaina_resultado', JSON.stringify(resultadoCalculado));", "localStorage.removeItem('janaina_resultado');");
code = code.replace(/\{previewResult\?\.resultado_dominante && <div className="result-preview"><span>✦<\/span><small>Sua principal área de atenção é<\/small><strong>\{previewResult\.resultado_dominante\}<\/strong><\/div>\}/, `<div className="result-preview result-locked"><span>✦</span><small>Seu padrão predominante foi identificado</small><strong>Resultado confidencial</strong><p>Existe um padrão se destacando nas suas respostas. Desbloqueie o relatório para descobrir qual é e entender como ele pode estar influenciando suas escolhas.</p></div>`);
code = code.replace('className={`hidden flex-1 items-center justify-center gap-2 py-3 px-3 rounded-lg text-sm font-bold transition-all cursor-pointer ${','className={`flex-1 flex items-center justify-center gap-2 py-3 px-3 rounded-lg text-sm font-bold transition-all cursor-pointer ${');
code = code.replace("{false && activePaymentTab === 'pix' && (", "{activePaymentTab === 'pix' && (");

const required = ["const [whatsapp, setWhatsapp] = useState('');",'Descubra o que está te impedindo de avançar','className="preview-nav"','className="lead-capture"','@eujanainaaraujo','Resultado confidencial','id="btn-pagar-cartao-stripe"',"{activePaymentTab === 'pix' && (",'QUERO APROFUNDAR MEU DIAGNÓSTICO'];
for (const fragment of required) if (!code.includes(fragment)) throw new Error(`Production guard failed: missing fragment: ${fragment}`);
if (/href="#(?:inicio|sobre|beneficios|faq)"/.test(code)) throw new Error('Landing navigation guard failed: secondary links are still present.');

fs.writeFileSync(appPath, code);
console.log('Production guards applied: clean CTA-only header / Instagram / locked result / R$ 9,90 / WhatsApp / Pix + card');
