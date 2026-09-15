import { RESULT_CONTENT, type ResultPattern } from './result-content';

const heroArtwork: Record<ResultPattern, string> = {
  MEDO: '/result-assets/medo-hero-clean.jpg',
  INSEGURANÇA: '/result-assets/inseguranca-hero-clean.jpg',
  PROCRASTINAÇÃO: '/result-assets/procrastinacao-hero-clean.jpg',
};

const patternPhrase: Record<ResultPattern, string> = {
  MEDO: 'Com consciência, a vida flui com mais leveza.',
  INSEGURANÇA: 'Você já é suficiente, exatamente como é.',
  PROCRASTINAÇÃO: 'Pequenos passos, grandes conquistas.',
};

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch] || ch));
const list = (items: string[]) => `<ul>${items.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`;
const paragraphs = (items: string[]) => items.map(item => `<p>${escapeHtml(item)}</p>`).join('');
const sectionIcon = (kind: string) => {
  const icons: Record<string,string> = {
    interpretation: '<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M25 55c-2-10-10-12-10-26C15 14 25 6 37 7c12 1 19 10 18 21-1 9-6 13-12 16v11"/><path d="M31 20c7-6 16-2 16 6M27 31c7 4 13 3 18 0"/></svg>',
    signs: '<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M10 43h44L42 25l-8 8-8-17-8 17-8-8z"/></svg>',
    effects: '<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M32 7 58 55H6L32 7z"/><path d="M32 22v17M32 47v1"/></svg>',
    path: '<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M12 48c14-2 21-11 26-25 4 11 1 24-9 31"/><path d="M20 55c4-16 14-28 31-37"/></svg>',
    practices: '<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M32 54V31"/><path d="M32 32C19 32 11 24 9 13c12 1 20 7 23 19M32 32c13 0 21-8 23-19-12 1-20 7-23 19"/><path d="M18 47c7 0 12 3 14 7M46 47c-7 0-12 3-14 7"/></svg>'
  };
  return icons[kind] || '';
};
const section = (kind: string, title: string, body: string) => `<section class="result-section result-${kind}"><h3><span class="result-section-icon" aria-hidden="true">${sectionIcon(kind)}</span>${title}</h3>${body}</section>`;

function enhance() {
  const card = document.querySelector<HTMLElement>('.report-card');
  if (!card || card.dataset.approved === '1') return;

  const title = card.querySelector('h2')?.textContent || '';
  const pattern: ResultPattern = title.includes('MEDO') ? 'MEDO' : title.includes('INSEGURANÇA') ? 'INSEGURANÇA' : 'PROCRASTINAÇÃO';
  const content = RESULT_CONTENT[pattern];
  const greeting = Array.from(card.querySelectorAll('p')).find(p => p.textContent?.trim().startsWith('Olá,'))?.textContent || 'Olá.';
  const name = greeting.replace(/^Olá,\s*/, '').replace(/\.$/, '').trim();
  const message = `Olá, Janaína! Meu nome é ${name || 'participante'} e meu padrão predominante foi ${pattern}.\n\nFiz o Mini Diagnóstico e gostaria de aprofundar meu resultado: ${pattern}.\n\nVim pelo Mini Diagnóstico — Janaína Araújo.`;
  const whatsapp = `https://wa.me/5521983928113?text=${encodeURIComponent(message)}`;
  const filename = `mini-diagnostico-${pattern.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')}.pdf`;
  const downloadUrl = `/api/download-result-pdf?pattern=${encodeURIComponent(pattern)}&filename=${encodeURIComponent(filename)}&name=${encodeURIComponent(name)}`;

  card.dataset.approved = '1';
  card.dataset.pattern = pattern;
  card.innerHTML = `<article class="result-poster">
    <header class="result-hero">
      <img class="result-hero-image" src="${heroArtwork[pattern]}" alt="" decoding="async">
      <div class="result-brand"><img src="/ja-logo-approved.webp" alt="Janaína Araújo"><div><strong>Mini Diagnóstico</strong><small>SUAS RESPOSTAS, SEU MAPA INTERIOR</small></div></div>
      <p class="result-phrase">${escapeHtml(patternPhrase[pattern])}<span class="result-heart" aria-hidden="true">♡</span></p>
      <div class="result-heading"><div class="result-eyebrow">SEU PADRÃO PREDOMINANTE É:</div><h2>${pattern}</h2><p>${escapeHtml(content.intro)}</p></div>
    </header>
    <main class="result-sections">
      ${section('interpretation','INTERPRETAÇÃO DO SEU RESULTADO', paragraphs(content.interpretation))}
      ${content.cycle ? section('cycle','CICLO', `<div class="result-cycle-text">${escapeHtml(content.cycle)}</div>`) : ''}
      <div class="result-pair">${section('signs','SINAIS COMUNS', list(content.signs))}${section('effects','O QUE ISSO PODE CAUSAR', list(content.effects))}</div>
      ${pattern === 'MEDO' ? '' : section('question','UMA PERGUNTA IMPORTANTE', `<p class="result-question-text">${escapeHtml(content.question)}</p><p>${escapeHtml(content.questionNote)}</p>`)}
      ${section('path','SEU CAMINHO DE TRANSFORMAÇÃO', paragraphs(content.path))}
      ${section('practices','PRÁTICAS SUGERIDAS', list(content.practices))}
      <blockquote class="result-final-quote">${escapeHtml(content.quote)}</blockquote>
      <div class="result-actions"><a class="result-whatsapp" href="${whatsapp}" target="_blank" rel="noopener noreferrer">QUERO APROFUNDAR MEU RESULTADO COM JANAÍNA</a><a class="result-download" href="${downloadUrl}" download="${filename}">BAIXAR MEU RESULTADO EM PDF</a></div>
      <footer class="result-footer"><img src="/ja-logo-approved.webp" alt=""><div><strong>Janaína Araújo</strong><span>TERAPEUTA INTEGRATIVA</span></div><small>AUTOCONHECIMENTO · EQUILÍBRIO · TRANSFORMAÇÃO</small></footer>
    </main>
  </article>`;
}

new MutationObserver(enhance).observe(document.documentElement, { childList: true, subtree: true });
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', enhance); else enhance();
