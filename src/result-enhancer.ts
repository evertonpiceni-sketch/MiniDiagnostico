import { RESULT_CONTENT, type ResultPattern } from './result-content';

const PDF_BY_PATTERN: Record<ResultPattern, string> = {
  MEDO: '/result-pdf/medo.pdf',
  INSEGURANÇA: '/result-pdf/inseguranca.pdf',
  PROCRASTINAÇÃO: '/result-pdf/procrastinacao.pdf',
};

function enhance() {
  const card = document.querySelector<HTMLElement>('.report-card');
  if (!card || card.dataset.approved === '1') return;

  const title = card.querySelector('h2')?.textContent || '';
  const pattern = ((Object.keys(RESULT_CONTENT) as ResultPattern[]).find(key => title.includes(key)) || 'PROCRASTINAÇÃO');
  const greeting = Array.from(card.querySelectorAll('p')).find(p => p.textContent?.trim().startsWith('Olá,'))?.textContent || 'Olá.';
  const name = greeting.replace(/^Olá,\s*/, '').replace(/\.$/, '');
  const message = `Olá, Janaína! Meu nome é ${name} e meu padrão predominante foi ${pattern}.\n\nFiz o Mini Diagnóstico e gostaria de aprofundar meu resultado: ${pattern}.\n\nVim pelo Mini Diagnóstico — Janaína Araújo.`;
  const pdf = PDF_BY_PATTERN[pattern];

  card.dataset.approved = '1';
  card.dataset.pattern = pattern;
  card.setAttribute('aria-label', `Resultado do Mini Diagnóstico: ${pattern}`);

  // IMPORTANT: the approved artwork is now the single visual source for the
  // on-screen result and for the downloaded PDF. We no longer reconstruct a
  // second generic HTML report, which was the source of the visual divergence.
  card.innerHTML = `<div class="approved-artwork-shell">
    <object class="approved-artwork" data="${pdf}#toolbar=0&navpanes=0&scrollbar=0&view=FitH" type="application/pdf" aria-label="Resultado aprovado — ${pattern}">
      <p>Seu navegador não exibiu a prévia. <a href="${pdf}" target="_blank" rel="noopener noreferrer">Abrir resultado em PDF</a>.</p>
    </object>
    <a class="approved-artwork-hotspot approved-artwork-whatsapp" href="https://wa.me/5521983928113?text=${encodeURIComponent(message)}" target="_blank" rel="noopener noreferrer" aria-label="Quero aprofundar meu resultado com Janaína"></a>
    <a class="approved-artwork-hotspot approved-artwork-download" href="${pdf}" download aria-label="Baixar meu resultado em PDF"></a>
  </div>`;
}

new MutationObserver(enhance).observe(document.documentElement, { childList: true, subtree: true });
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', enhance);
else enhance();
