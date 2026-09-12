import { RESULT_CONTENT, type ResultPattern } from './result-content';

const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] || c));
const paragraphs = (items: string[]) => items.map(item => `<p>${esc(item)}</p>`).join('');

function enhance() {
  const card = document.querySelector<HTMLElement>('.report-card');
  if (!card || card.dataset.approved === '1') return;
  const title = card.querySelector('h2')?.textContent || '';
  const pattern = ((Object.keys(RESULT_CONTENT) as ResultPattern[]).find(key => title.includes(key)) || 'PROCRASTINAÇÃO');
  const content = RESULT_CONTENT[pattern];
  const greeting = Array.from(card.querySelectorAll('p')).find(p => p.textContent?.trim().startsWith('Olá,'))?.textContent || 'Olá.';
  const name = greeting.replace(/^Olá,\s*/, '').replace(/\.$/, '');
  const message = `Olá, Janaína! Meu nome é ${name} e meu padrão predominante foi ${pattern}.\n\nFiz o Mini Diagnóstico e gostaria de aprofundar meu resultado: ${pattern}.\n\nVim pelo Mini Diagnóstico — Janaína Araújo.`;
  const question = content.question ? `<section class="result-wide result-question"><h3>UMA PERGUNTA IMPORTANTE</h3><p class="result-question-text">“${esc(content.question)}”</p><p>${esc(content.questionNote)}</p></section>` : '';

  card.dataset.approved = '1';
  card.dataset.pattern = pattern;
  card.innerHTML = `<header class="approved-result-hero"><div class="result-brand"><img src="/ja-logo-approved.webp" alt="Janaína Araújo"><div><strong>Mini Diagnóstico</strong><small>SUAS RESPOSTAS, SEU MAPA INTERIOR</small></div></div><p>SEU PADRÃO PREDOMINANTE É:</p><h1>${esc(pattern)}</h1><em>${esc(content.intro)}</em></header><main class="approved-result-body"><section class="result-wide result-interpretation"><h3>INTERPRETAÇÃO DO SEU RESULTADO</h3>${paragraphs(content.interpretation)}${content.cycle ? `<div class="result-cycle">${esc(content.cycle)}</div>` : ''}</section><div class="result-grid"><section><h3>SINAIS COMUNS</h3><ul>${content.signs.map(item => `<li>${esc(item)}</li>`).join('')}</ul></section><section><h3>O QUE ISSO PODE CAUSAR</h3><ul>${content.effects.map(item => `<li>${esc(item)}</li>`).join('')}</ul></section></div>${question}<section class="result-wide result-path"><h3>SEU CAMINHO DE TRANSFORMAÇÃO</h3>${paragraphs(content.path)}</section><section class="result-wide result-practices"><h3>PRÁTICAS SUGERIDAS</h3><ul>${content.practices.map(item => `<li>${esc(item)}</li>`).join('')}</ul></section><blockquote>“${esc(content.quote)}”</blockquote><div class="result-actions"><a class="result-whatsapp" href="https://wa.me/5521983928113?text=${encodeURIComponent(message)}" target="_blank" rel="noopener noreferrer">QUERO APROFUNDAR MEU RESULTADO COM JANAÍNA</a><a class="result-pdf" href="#">BAIXAR MEU RESULTADO EM PDF</a></div></main><footer class="approved-result-footer"><div><img src="/ja-logo-approved.webp" alt=""><b>Janaína Araújo</b><span>TERAPEUTA INTEGRATIVA</span></div><small>AUTOCONHECIMENTO &nbsp; • &nbsp; EQUILÍBRIO &nbsp; • &nbsp; TRANSFORMAÇÃO<br>JUNTOS SOMOS MELHORES</small></footer>`;

  const download = card.querySelector<HTMLAnchorElement>('.result-pdf');
  download?.addEventListener('click', event => {
    event.preventDefault();
    card.classList.add('pdf-printing');
    const cleanup = () => card.classList.remove('pdf-printing');
    window.addEventListener('afterprint', cleanup, { once: true });
    window.print();
    window.setTimeout(cleanup, 1800);
  });
}

new MutationObserver(enhance).observe(document.documentElement, { childList: true, subtree: true });
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', enhance);
else enhance();
