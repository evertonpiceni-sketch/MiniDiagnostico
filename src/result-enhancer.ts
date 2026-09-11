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
  const technical = card.dataset.technical === '1';
  const pdf = card.querySelector<HTMLAnchorElement>('.report-download')?.href || '#';
  const approvedPdf = `/result-pdf/${pattern === 'MEDO' ? 'medo' : pattern === 'INSEGURANÇA' ? 'inseguranca' : 'procrastinacao'}.pdf`;
  const message = `Olá, Janaína!\n\nMeu nome é ${name}. Fiz o Mini Diagnóstico e meu padrão predominante foi ${pattern}.\n\nGostaria de aprofundar meu resultado: ${pattern}. Quero compreender melhor o que apareceu no meu diagnóstico e como posso aprofundar esse processo com o seu acompanhamento.\n\nVim pelo Mini Diagnóstico — Janaína Araújo.`;
  card.dataset.approved = '1';
  card.dataset.pattern = pattern;
  card.innerHTML = `<header class="approved-result-hero"><div class="result-brand"><span class="result-lotus">◇</span><div><strong>Mini Diagnóstico</strong><small>SUAS RESPOSTAS, SEU MAPA INTERIOR</small></div></div><p>SEU PADRÃO PREDOMINANTE É:</p><h1>${esc(pattern)}</h1><em>${esc(content.intro)}</em></header><main class="approved-result-body"><section class="result-wide result-interpretation"><h3>◉ &nbsp; INTERPRETAÇÃO DO SEU RESULTADO</h3>${paragraphs(content.interpretation)}${content.cycle ? `<div class="result-cycle">${esc(content.cycle)}</div>` : ''}</section><div class="result-grid"><section><h3>● &nbsp; SINAIS COMUNS</h3><ul>${content.signs.map(item => `<li>✓ ${esc(item)}</li>`).join('')}</ul></section><section><h3>▲ &nbsp; O QUE ISSO PODE CAUSAR</h3><ul>${content.effects.map(item => `<li>✓ ${esc(item)}</li>`).join('')}</ul></section></div><section class="result-wide result-question"><h3>? &nbsp; UMA PERGUNTA IMPORTANTE</h3><p class="result-question-text">“${esc(content.question)}”</p><p>${esc(content.questionNote)}</p></section><section class="result-wide result-path"><h3>❧ &nbsp; SEU CAMINHO DE TRANSFORMAÇÃO</h3>${paragraphs(content.path)}</section><section class="result-wide result-practices"><h3>✦ &nbsp; PRÁTICAS SUGERIDAS</h3><ul>${content.practices.map(item => `<li>✓ ${esc(item)}</li>`).join('')}</ul></section><blockquote>“${esc(content.quote)}”</blockquote><div class="result-actions"><a class="result-whatsapp" href="https://wa.me/5521983928113?text=${encodeURIComponent(message)}" target="_blank" rel="noopener noreferrer">QUERO APROFUNDAR COM JANAÍNA</a><a class="result-pdf" href="${esc(technical ? approvedPdf : pdf)}"${technical ? ' download' : ''}>BAIXAR MEU RESULTADO EM PDF</a></div></main><footer class="approved-result-footer"><b>Janaína Araújo</b><span>AUTOCONHECIMENTO • EQUILÍBRIO • TRANSFORMAÇÃO</span><small>JUNTOS SOMOS MELHORES ♡</small></footer>`;
}

new MutationObserver(enhance).observe(document.documentElement, { childList: true, subtree: true });
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', enhance);
else enhance();
