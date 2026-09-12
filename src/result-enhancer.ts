import type { ResultPattern } from './result-content';

const artwork: Record<ResultPattern, string> = {
  MEDO: '/result-pdf/medo.pdf',
  INSEGURANÇA: '/result-pdf/inseguranca.pdf',
  PROCRASTINAÇÃO: '/result-pdf/procrastinacao.pdf',
};

function enhance() {
  const card = document.querySelector<HTMLElement>('.report-card');
  if (!card || card.dataset.approved === '1') return;
  const title = card.querySelector('h2')?.textContent || '';
  const pattern: ResultPattern = title.includes('MEDO') ? 'MEDO' : title.includes('INSEGURANÇA') ? 'INSEGURANÇA' : 'PROCRASTINAÇÃO';
  const greeting = Array.from(card.querySelectorAll('p')).find(p => p.textContent?.trim().startsWith('Olá,'))?.textContent || 'Olá.';
  const name = greeting.replace(/^Olá,\s*/, '').replace(/\.$/, '');
  const message = `Olá, Janaína! Meu nome é ${name} e meu padrão predominante foi ${pattern}.\n\nFiz o Mini Diagnóstico e gostaria de aprofundar meu resultado: ${pattern}.\n\nVim pelo Mini Diagnóstico — Janaína Araújo.`;
  const pdf = artwork[pattern];

  card.dataset.approved = '1';
  card.dataset.pattern = pattern;
  card.innerHTML = `<div class="approved-artwork-result"><object class="approved-artwork" data="${pdf}#toolbar=0&navpanes=0&scrollbar=0&view=FitH" type="application/pdf" aria-label="Resultado ${pattern}"><a href="${pdf}" target="_blank" rel="noopener noreferrer">Abrir resultado ${pattern}</a></object><a class="artwork-hotspot artwork-whatsapp" href="https://wa.me/5521983928113?text=${encodeURIComponent(message)}" target="_blank" rel="noopener noreferrer" aria-label="Quero aprofundar meu resultado com Janaína"></a><a class="artwork-hotspot artwork-pdf" href="${pdf}" target="_blank" rel="noopener noreferrer" aria-label="Baixar meu resultado em PDF"></a></div>`;
}

new MutationObserver(enhance).observe(document.documentElement, { childList: true, subtree: true });
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', enhance);
else enhance();
