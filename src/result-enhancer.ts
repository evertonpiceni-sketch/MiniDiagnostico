import { PDFArray, PDFDocument, PDFName, PDFNumber, PDFString } from 'pdf-lib';
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


async function waitForImages(root: HTMLElement) {
  const images = Array.from(root.querySelectorAll('img'));
  await Promise.all(images.map(img => img.complete ? Promise.resolve() : new Promise<void>(resolve => {
    img.addEventListener('load', () => resolve(), { once: true });
    img.addEventListener('error', () => resolve(), { once: true });
  })));
}

function collectCssText() {
  return Array.from(document.styleSheets).map(sheet => {
    try { return Array.from(sheet.cssRules).map(rule => rule.cssText).join('\n'); }
    catch { return ''; }
  }).join('\n');
}

async function captureResultPng(poster: HTMLElement) {
  await waitForImages(poster);
  await document.fonts?.ready;

  const rect = poster.getBoundingClientRect();
  const width = Math.ceil(Math.max(rect.width, poster.scrollWidth));
  const height = Math.ceil(Math.max(rect.height, poster.scrollHeight));
  const clone = poster.cloneNode(true) as HTMLElement;
  clone.style.width = width + 'px';
  clone.style.maxWidth = 'none';
  clone.style.margin = '0';

  const css = collectCssText();
  const serialized = new XMLSerializer().serializeToString(clone);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <foreignObject width="100%" height="100%">
      <div xmlns="http://www.w3.org/1999/xhtml"><style>${css}</style>${serialized}</div>
    </foreignObject>
  </svg>`;

  const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  try {
    const image = new Image();
    image.decoding = 'async';
    const loaded = new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error('RESULT_CAPTURE_IMAGE'));
    });
    image.src = url;
    await loaded;

    const scale = Math.min(2, 8192 / Math.max(width, height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('RESULT_CAPTURE_CANVAS');
    context.scale(scale, scale);
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, width, height);
    context.drawImage(image, 0, 0, width, height);

    const pngBlob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(value => value ? resolve(value) : reject(new Error('RESULT_CAPTURE_PNG')), 'image/png', 1)
    );
    return { bytes: new Uint8Array(await pngBlob.arrayBuffer()), width, height };
  } finally {
    URL.revokeObjectURL(url);
  }
}

function addPdfLink(pdf: PDFDocument, pageIndex: number, rect: { x: number; y: number; width: number; height: number }, url: string) {
  const page = pdf.getPages()[pageIndex];
  if (!page) return;
  const box = PDFArray.withContext(pdf.context);
  [rect.x, rect.y, rect.x + rect.width, rect.y + rect.height].forEach(value => box.push(PDFNumber.of(value)));
  const action = pdf.context.obj({ S: PDFName.of('URI'), URI: PDFString.of(url) });
  const annotation = pdf.context.obj({
    Type: PDFName.of('Annot'),
    Subtype: PDFName.of('Link'),
    Rect: box,
    Border: [0, 0, 0],
    H: PDFName.of('I'),
    A: action,
  });
  const annotationRef = pdf.context.register(annotation);
  const existing = page.node.lookupMaybe(PDFName.of('Annots'), PDFArray);
  const annots = existing || PDFArray.withContext(pdf.context);
  annots.push(annotationRef);
  if (!existing) page.node.set(PDFName.of('Annots'), annots);
}

async function downloadMedoPdf(card: HTMLElement, filename: string, whatsapp: string) {
  const poster = card.querySelector<HTMLElement>('.result-poster');
  if (!poster) throw new Error('RESULT_POSTER_NOT_FOUND');

  const whatsappButton = poster.querySelector<HTMLElement>('.result-whatsapp');
  const posterRect = poster.getBoundingClientRect();
  const whatsappRect = whatsappButton?.getBoundingClientRect();
  const capture = await captureResultPng(poster);

  const pdf = await PDFDocument.create();
  const pageWidth = capture.width * 0.75;
  const pageHeight = capture.height * 0.75;
  const page = pdf.addPage([pageWidth, pageHeight]);
  const png = await pdf.embedPng(capture.bytes);
  page.drawImage(png, { x: 0, y: 0, width: pageWidth, height: pageHeight });

  if (whatsappRect) {
    const scaleX = pageWidth / posterRect.width;
    const scaleY = pageHeight / posterRect.height;
    addPdfLink(pdf, 0, {
      x: (whatsappRect.left - posterRect.left) * scaleX,
      y: pageHeight - (whatsappRect.bottom - posterRect.top) * scaleY,
      width: whatsappRect.width * scaleX,
      height: whatsappRect.height * scaleY,
    }, whatsapp);
  }

  const bytes = await pdf.save();
  const blob = new Blob([bytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  try {
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

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

  if (pattern === 'MEDO') {
    const download = card.querySelector<HTMLAnchorElement>('.result-download');
    if (download) {
      download.href = '#';
      download.removeAttribute('download');
      download.addEventListener('click', async event => {
        event.preventDefault();
        if (download.dataset.generating === '1') return;
        download.dataset.generating = '1';
        download.setAttribute('aria-busy', 'true');
        try {
          await downloadMedoPdf(card, filename, whatsapp);
        } catch (error) {
          console.error('MEDO PDF generation error', error);
          window.location.href = downloadUrl;
        } finally {
          delete download.dataset.generating;
          download.removeAttribute('aria-busy');
        }
      });
    }
  }
}

new MutationObserver(enhance).observe(document.documentElement, { childList: true, subtree: true });
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', enhance); else enhance();
