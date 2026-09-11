import { RESULT_CONTENT, type ResultPattern } from './result-content';

const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] || c));
const paragraphs = (items: string[]) => items.map(item => `<p>${esc(item)}</p>`).join('');

function printDisplayedResult(card: HTMLElement) {
  const clone = card.cloneNode(true) as HTMLElement;
  clone.querySelector('.result-actions')?.remove();
  const styles = Array.from(document.querySelectorAll('link[rel="stylesheet"],style')).map(node => node.outerHTML).join('\n');
  const win = window.open('', '_blank');
  if (!win) return;
  win.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Resultado - Procrastinação</title>${styles}<style>@page{size:A4;margin:8mm}body{margin:0;background:#fff!important}.brand-shell{min-height:0!important}.report-card{width:100%!important;max-width:100%!important;margin:0!important;box-shadow:none!important}.ambient-audio-pill{display:none!important}@media print{.result-actions{display:none!important}}</style></head><body>${clone.outerHTML}<script>window.onload=()=>{setTimeout(()=>window.print(),250)}<\/script></body></html>`);
  win.document.close();
}

function enhance() {
  const card = document.querySelector<HTMLElement>('.report-card');
  if (!card || card.dataset.approved === '1') return;
  const title = card.querySelector('h2')?.textContent || '';
  const pattern = ((Object.keys(RESULT_CONTENT) as ResultPattern[]).find(key => title.includes(key)) || 'PROCRASTINAÇÃO');
  const content = RESULT_CONTENT[pattern];
  const greeting = Array.from(card.querySelectorAll('p')).find(p => p.textContent?.trim().startsWith('Olá,'))?.textContent || 'Olá.';
  const name = greeting.replace(/^Olá,\s*/, '').replace(/\.$/, '');
  const pdf = card.querySelector<HTMLAnchorElement>('.report-download')?.href || '#';
  const message = `Olá, Janaína! Meu nome é ${name} e meu padrão predominante foi ${pattern}.\n\nFiz o Mini Diagnóstico e gostaria de aprofundar meu resultado: ${pattern}.\n\nVim pelo Mini Diagnóstico — Janaína Araújo.`;
  card.dataset.approved = '1';
  card.dataset.pattern = pattern;
  card.innerHTML = `<header class="approved-result-hero"><div class="result-brand"><span class="result-lotus">◇</span><div><strong>Mini Diagnóstico</strong><small>SUAS RESPOSTAS, SEU MAPA INTERIOR</small></div></div><p>SEU PADRÃO PREDOMINANTE É:</p><h1>${esc(pattern)}</h1><em>${esc(content.intro)}</em></header><main class="approved-result-body"><section class="result-wide result-interpretation"><h3>◉ &nbsp; INTERPRETAÇÃO DO SEU RESULTADO</h3>${paragraphs(content.interpretation)}${content.cycle ? `<div class="result-cycle">${esc(content.cycle)}</div>` : ''}</section><div class="result-grid"><section><h3>● &nbsp; SINAIS COMUNS</h3><ul>${content.signs.map(item => `<li>✓ ${esc(item)}</li>`).join('')}</ul></section><section><h3>▲ &nbsp; O QUE ISSO PODE CAUSAR</h3><ul>${content.effects.map(item => `<li>✓ ${esc(item)}</li>`).join('')}</ul></section></div><section class="result-wide result-question"><h3>? &nbsp; UMA PERGUNTA IMPORTANTE</h3><p class="result-question-text">“${esc(content.question)}”</p><p>${esc(content.questionNote)}</p></section><section class="result-wide result-path"><h3>❧ &nbsp; SEU CAMINHO DE TRANSFORMAÇÃO</h3>${paragraphs(content.path)}</section><section class="result-wide result-practices"><h3>✦ &nbsp; PRÁTICAS SUGERIDAS</h3><ul>${content.practices.map(item => `<li>✓ ${esc(item)}</li>`).join('')}</ul></section><blockquote>“${esc(content.quote)}”</blockquote><div class="result-actions"><a class="result-whatsapp" href="https://wa.me/5521983928113?text=${encodeURIComponent(message)}" target="_blank" rel="noopener noreferrer">QUERO APROFUNDAR COM JANAÍNA</a><a class="result-pdf" href="${esc(pdf)}">BAIXAR MEU RESULTADO EM PDF</a></div></main><footer class="approved-result-footer"><b>Janaína Araújo</b><span>AUTOCONHECIMENTO • EQUILÍBRIO • TRANSFORMAÇÃO</span><small>JUNTOS SOMOS MELHORES ♡</small></footer>`;
  if (pattern === 'PROCRASTINAÇÃO') {
    const button = card.querySelector<HTMLAnchorElement>('.result-pdf');
    button?.addEventListener('click', event => {
      event.preventDefault();
      printDisplayedResult(card);
    });
  }
}

new MutationObserver(enhance).observe(document.documentElement, { childList: true, subtree: true });
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', enhance);
else enhance();
