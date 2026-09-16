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
const commonIcons: Record<string,string> = {
  interpretation: '<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M25 55c-2-10-10-12-10-26C15 14 25 6 37 7c12 1 19 10 18 21-1 9-6 13-12 16v11"/><path d="M31 20c7-6 16-2 16 6M27 31c7 4 13 3 18 0"/></svg>',
  effects: '<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M32 7 58 55H6L32 7z"/><path d="M32 22v17M32 47v1"/></svg>',
  path: '<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M12 48c14-2 21-11 26-25 4 11 1 24-9 31"/><path d="M20 55c4-16 14-28 31-37"/></svg>',
  practices: '<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M32 54V31"/><path d="M32 32C19 32 11 24 9 13c12 1 20 7 23 19M32 32c13 0 21-8 23-19-12 1-20 7-23 19"/><path d="M18 47c7 0 12 3 14 7M46 47c-7 0-12 3-14 7"/></svg>',
  question: '<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M20 24c0-8 6-13 14-13 8 0 14 5 14 12 0 6-3 9-8 12-5 3-7 6-7 11"/><path d="M33 53v1"/></svg>',
  cycle: '<svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="23"/><path d="M32 18v15l10 6"/></svg>'
};
const sectionIcon = (pattern: ResultPattern, kind: string) => {
  if (kind === 'signs') {
    if (pattern === 'MEDO') return '<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M15 45h34c6 0 10-4 10-10 0-5-4-9-9-10-2-8-8-13-16-13-9 0-16 6-17 15-7 1-12 6-12 12 0 4 4 6 10 6z"/></svg>';
    if (pattern === 'INSEGURANÇA') return '<svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="23" cy="22" r="8"/><circle cx="43" cy="22" r="8"/><path d="M8 53c1-13 7-19 15-19s14 6 15 19M29 53c1-13 7-19 14-19 8 0 13 6 14 19"/></svg>';
    return '<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M20 8h24M20 56h24M23 9c0 12 8 14 9 23-1 9-9 11-9 23M41 9c0 12-8 14-9 23 1 9 9 11 9 23"/></svg>';
  }
  if (kind === 'effects' && pattern === 'PROCRASTINAÇÃO') return '<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M25 12c-8 0-13 6-13 13 0 4 2 7 5 9-3 2-5 6-5 10 0 8 6 13 14 13 3 0 5-1 7-3 2 2 5 3 8 3 8 0 14-5 14-13 0-4-2-8-5-10 3-2 5-5 5-9 0-7-5-13-13-13-4 0-7 2-9 5-2-3-5-5-8-5z"/><path d="M32 17v37M22 24c4 0 7 3 7 7M42 24c-4 0-7 3-7 7M22 43c4 0 7-3 7-7M42 43c-4 0-7-3-7-7"/></svg>';
  return commonIcons[kind] || '';
};
const section = (pattern: ResultPattern, kind: string, title: string, body: string) => `<section class="result-section result-${kind}"><h3><span class="result-section-icon" aria-hidden="true">${sectionIcon(pattern, kind)}</span>${title}</h3>${body}</section>`;

// Keep the five definitive stages, with the approved line-icon cycle treatment.
const cycleIcons = [
  '<circle cx="24" cy="24" r="19"/><path d="M24 11v14l9 5"/>',
  '<circle cx="24" cy="24" r="19"/><path d="M15 27q9 13 18 0M17 17v1M31 17v1"/>',
  '<rect x="10" y="5" width="28" height="38" rx="4"/><path d="M17 14h14M17 22h14M17 30h14"/>',
  '<circle cx="24" cy="24" r="19"/><path d="M15 33q9-13 18 0M17 17v1M31 17v1"/>',
  '<circle cx="24" cy="24" r="19"/><path d="M13 30l8-10 7 7 7-13M29 14h6v6"/>',
];
const cycleMarkup = (text: string) => text.split(' → ').map((stage, index) => `<span class="result-cycle-stage"><svg viewBox="0 0 48 48" aria-hidden="true">${cycleIcons[index]}</svg><span>${escapeHtml(stage)}</span></span>`).join(' <span class="result-cycle-arrow">→</span> ');

function enhance() {
  const card = document.querySelector<HTMLElement>('.report-card');
  if (!card || card.dataset.approved === '1') return;

  const title = card.querySelector('h2')?.textContent || '';
  const pattern: ResultPattern = title.includes('MEDO') ? 'MEDO' : title.includes('INSEGURANÇA') ? 'INSEGURANÇA' : 'PROCRASTINAÇÃO';
  const content = RESULT_CONTENT[pattern];
  const logo = pattern === 'MEDO' ? '/result-assets/medo-logo-approved.png' : '/result-assets/logo-reference.png';
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
      ${pattern === 'PROCRASTINAÇÃO' ? '<div class="result-sign-labels" aria-label="PLANEJAR, COMEÇAR, CONQUISTAR"><span>PLANEJAR</span><span>COMEÇAR</span><span>CONQUISTAR</span></div>' : ''}
      <div class="result-brand"><img src="${logo}" alt="Janaína Araújo"><div><strong>Mini Diagnóstico</strong><small>SUAS RESPOSTAS, SEU MAPA INTERIOR</small></div></div>
      <p class="result-phrase">${escapeHtml(patternPhrase[pattern])}<span class="result-heart" aria-hidden="true">♡</span></p>
      <div class="result-heading"><div class="result-eyebrow">SEU PADRÃO PREDOMINANTE É:</div><h2>${pattern}</h2><p>${escapeHtml(content.intro)}</p></div>
    </header>
    <main class="result-sections">
      ${section(pattern,'interpretation','INTERPRETAÇÃO DO SEU RESULTADO', paragraphs(content.interpretation))}
      ${content.cycle ? section(pattern,'cycle','CICLO EM DESTAQUE', `<div class="result-cycle-text">${cycleMarkup(content.cycle)}</div>`) : ''}
      <div class="result-pair">${section(pattern,'signs','SINAIS COMUNS', list(content.signs))}${section(pattern,'effects','O QUE ISSO PODE CAUSAR', list(content.effects))}</div>
      ${section(pattern,'question','UMA PERGUNTA IMPORTANTE', `<p class="result-question-text">${escapeHtml(content.question)}</p><p>${escapeHtml(content.questionNote)}</p>`)}
      ${section(pattern,'path','SEU CAMINHO DE TRANSFORMAÇÃO', paragraphs(content.path))}
      ${section(pattern,'practices','PRÁTICAS SUGERIDAS', list(content.practices))}
      <blockquote class="result-final-quote">${escapeHtml(content.quote)}</blockquote>
      <div class="result-actions">
        <a class="result-whatsapp" href="${whatsapp}" target="_blank" rel="noopener noreferrer"><span class="result-action-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M20 11.7a8 8 0 0 1-11.8 7l-4.2 1.1 1.1-4A8 8 0 1 1 20 11.7Z"/><path d="M8.2 8.2c.4 3 2.7 5.4 5.7 5.9M14.4 14c.5 0 1.3-.7 1.5-1.2"/></svg></span><span>QUERO APROFUNDAR MEU<br>RESULTADO COM JANAÍNA</span></a>
        <a class="result-download" href="${downloadUrl}" download="${filename}"><span class="result-action-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 3v11m0 0-4-4m4 4 4-4M5 18v3h14v-3"/></svg></span><span>BAIXAR MEU RESULTADO EM PDF</span></a>
      </div>
      <footer class="result-footer"><img src="${logo}" alt=""><div><strong>Janaína Araújo</strong><span>TERAPEUTA INTEGRATIVA</span></div><small>AUTOCONHECIMENTO&nbsp;&nbsp;·&nbsp;&nbsp;EQUILÍBRIO&nbsp;&nbsp;·&nbsp;&nbsp;TRANSFORMAÇÃO<br><b>JUNTOS SOMOS MELHORES ♡</b></small></footer>
    </main>
  </article>`;
}

new MutationObserver(enhance).observe(document.documentElement, { childList: true, subtree: true });
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', enhance); else enhance();
