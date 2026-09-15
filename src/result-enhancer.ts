import { RESULT_CONTENT, type ResultPattern } from './result-content';

const heroArtwork: Record<ResultPattern, string> = {
  MEDO: '/result-assets/medo-hero-clean.jpg',
  INSEGURANÇA: '/result-assets/inseguranca-hero-clean.jpg',
  PROCRASTINAÇÃO: '/result-assets/procrastinacao-hero-clean.jpg',
};

const icon = (kind: string) => {
  const icons: Record<string, string> = {
    interpretation: '<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M25 55c-2-10-10-12-10-26C15 14 25 6 37 7c12 1 19 10 18 21-1 9-6 13-12 16v11"/><path d="M31 20c7-6 16-2 16 6M27 31c7 4 13 3 18 0"/></svg>',
    cycle: '<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M12 23a22 22 0 0 1 38-7l4 6M52 41a22 22 0 0 1-38 7l-4-6"/><path d="M45 22h9v-9M19 42h-9v9"/></svg>',
    signs: '<svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="23" cy="20" r="8"/><circle cx="43" cy="19" r="7"/><path d="M8 50c1-13 7-20 16-20 10 0 15 7 17 20M35 50c1-11 6-17 13-17 8 0 12 6 13 17"/></svg>',
    effects: '<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M10 52h10V39H10zm17 0h10V29H27zm17 0h10V16H44z"/><path d="M9 32l13-10 10 4 18-16"/></svg>',
    question: '<svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="24"/><path d="M25 25c1-6 13-8 17-2 5 8-6 10-8 16"/><circle cx="33" cy="47" r="2.5"/></svg>',
    path: '<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M12 18h33l8 8-8 8H12l-8-8zm40 24H19l-8 8 8 8h33l8-8z"/><path d="M32 10v48"/></svg>',
    practices: '<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M32 5l6 9 11-1 1 11 9 6-7 8 3 11-11 3-5 10-9-6-10 6-5-10-11-3 3-11-7-8 9-6 1-11 11 1z"/><circle cx="32" cy="32" r="10"/></svg>',
    quote: '<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M32 55C16 45 8 38 8 25 8 13 22 9 32 21 42 9 56 13 56 25c0 13-8 20-24 30z"/></svg>',
  };
  return icons[kind] || '';
};

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch] || ch));
const list = (items: string[]) => `<ul>${items.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`;
const paragraphs = (items: string[]) => items.map(item => `<p>${escapeHtml(item)}</p>`).join('');
const section = (kind: string, title: string, body: string, extra = '') => `<section class="result-section ${extra}"><div class="result-icon">${icon(kind)}</div><div class="result-copy"><h3>${title}</h3>${body}</div></section>`;

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
  const signposts = pattern === 'PROCRASTINAÇÃO' ? '<div class="approved-signposts" aria-hidden="true"><span>PLANEJAR</span><span>COMEÇAR</span><span>CONQUISTAR</span></div>' : '';

  card.dataset.approved = '1';
  card.dataset.pattern = pattern;
  card.innerHTML = `<article class="result-poster">
    <div class="result-hero"><img class="result-hero-image" src="${heroArtwork[pattern]}" alt="Mini Diagnóstico — ${pattern}" decoding="async">${signposts}</div>
    <header class="result-heading">
      <div class="result-eyebrow">SEU PADRÃO PREDOMINANTE É:</div>
      <h2>${pattern}</h2>
      <p class="result-opening">${escapeHtml(content.intro)}</p>
    </header>
    <div class="result-sections">
      ${section('interpretation','INTERPRETAÇÃO DO SEU RESULTADO', paragraphs(content.interpretation))}
      ${content.cycle ? section('cycle','CICLO EM DESTAQUE', `<div class="result-cycle">${escapeHtml(content.cycle)}</div>`, 'cycle compact') : ''}
      <div class="result-pair">
        ${section('signs','SINAIS', list(content.signs), 'compact')}
        ${section('effects','EFEITOS', list(content.effects), 'compact')}
      </div>
      ${section('question','UMA PERGUNTA IMPORTANTE', `<p>${escapeHtml(content.question)}</p><p>${escapeHtml(content.questionNote)}</p>`, 'question compact')}
      ${section('path','CAMINHO DE TRANSFORMAÇÃO', paragraphs(content.path), 'path compact')}
      ${section('practices','PRÁTICAS', list(content.practices), 'compact')}
      ${section('quote','FRASE FINAL', `<p>${escapeHtml(content.quote)}</p>`, 'quote compact')}
      <div class="result-actions">
        <a class="result-whatsapp" href="${whatsapp}" target="_blank" rel="noopener noreferrer">QUERO APROFUNDAR MEU RESULTADO COM JANAÍNA</a>
        <a class="result-download" href="${downloadUrl}" download="${filename}">BAIXAR MEU RESULTADO EM PDF</a>
      </div>
      <footer class="result-footer">JANAÍNA ARAÚJO • TERAPEUTA INTEGRATIVA • JUNTOS SOMOS MELHORES</footer>
    </div>
  </article>`;
}

new MutationObserver(enhance).observe(document.documentElement, { childList: true, subtree: true });
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', enhance);
else enhance();
