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
const section = (kind: string, title: string, body: string, extra = '') => `<section class="result-section result-${kind} ${extra}"><h3>${title}</h3>${body}</section>`;

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
    <header class="result-brand-header">
      <img src="/ja-logo-approved.webp" alt="Janaína Araújo">
      <div class="result-brand-copy"><strong>Mini Diagnóstico</strong><small>SUAS RESPOSTAS, SEU MAPA INTERIOR</small></div>
      <p>${escapeHtml(patternPhrase[pattern])}</p>
    </header>
    <div class="result-hero"><img class="result-hero-image" src="${heroArtwork[pattern]}" alt="" decoding="async"></div>
    <header class="result-heading">
      <div class="result-eyebrow">SEU PADRÃO PREDOMINANTE É:</div>
      <h2>${pattern}</h2>
      <p class="result-opening">${escapeHtml(content.intro)}</p>
    </header>
    <div class="result-sections">
      ${section('interpretation','INTERPRETAÇÃO DO SEU RESULTADO', paragraphs(content.interpretation))}
      ${content.cycle ? section('cycle','CICLO EM DESTAQUE', `<div class="result-cycle-text">${escapeHtml(content.cycle)}</div>`, 'compact') : ''}
      <div class="result-pair">
        ${section('signs','SINAIS', list(content.signs), 'compact')}
        ${section('effects','EFEITOS', list(content.effects), 'compact')}
      </div>
      ${section('question','UMA PERGUNTA IMPORTANTE', `<p class="result-question-text">${escapeHtml(content.question)}</p><p>${escapeHtml(content.questionNote)}</p>`, 'compact')}
      ${section('path','CAMINHO DE TRANSFORMAÇÃO', paragraphs(content.path), 'compact')}
      ${section('practices','PRÁTICAS', list(content.practices), 'compact')}
      <blockquote class="result-final-quote">${escapeHtml(content.quote)}</blockquote>
      <div class="result-actions">
        <a class="result-whatsapp" href="${whatsapp}" target="_blank" rel="noopener noreferrer">QUERO APROFUNDAR MEU RESULTADO COM JANAÍNA</a>
        <a class="result-download" href="${downloadUrl}" download="${filename}">BAIXAR MEU RESULTADO EM PDF</a>
      </div>
      <footer class="result-footer"><img src="/ja-logo-approved.webp" alt=""><div><strong>Janaína Araújo</strong><span>TERAPEUTA INTEGRATIVA</span></div><small>JUNTOS SOMOS MELHORES</small></footer>
    </div>
  </article>`;
}

new MutationObserver(enhance).observe(document.documentElement, { childList: true, subtree: true });
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', enhance);
else enhance();
