import type { ResultPattern } from './result-content';

const artwork: Record<ResultPattern, string> = {
  MEDO: '/result-pdf/medo.pdf',
  INSEGURANÇA: '/result-pdf/inseguranca.pdf',
  PROCRASTINAÇÃO: '/result-pdf/procrastinacao.pdf',
};

async function renderPdf(canvas: HTMLCanvasElement, url: string) {
  try {
    const pdfjs = await import(/* @vite-ignore */ 'https://cdn.jsdelivr.net/npm/pdfjs-dist@5.4.149/build/pdf.min.mjs');
    pdfjs.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@5.4.149/build/pdf.worker.min.mjs';
    const doc = await pdfjs.getDocument(url).promise;
    const page = await doc.getPage(1);
    const base = page.getViewport({ scale: 1 });
    const targetWidth = Math.min(1536, Math.max(900, window.innerWidth * Math.min(window.devicePixelRatio || 1, 2)));
    const viewport = page.getViewport({ scale: targetWidth / base.width });
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    canvas.style.aspectRatio = `${canvas.width} / ${canvas.height}`;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('Canvas indisponível');
    await page.render({ canvasContext: ctx, viewport, canvas }).promise;
    canvas.dataset.ready = '1';
  } catch (error) {
    console.error('Falha ao renderizar resultado aprovado', error);
    const fallback = canvas.parentElement?.querySelector<HTMLAnchorElement>('.artwork-fallback');
    if (fallback) fallback.hidden = false;
  }
}

async function downloadPdf(url: string, pattern: ResultPattern) {
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) throw new Error(`Falha ao baixar PDF: ${response.status}`);
  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = `mini-diagnostico-${pattern.toLowerCase().replace('ç', 'c').replace('ã', 'a')}.pdf`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1500);
}

function enhance() {
  const card = document.querySelector<HTMLElement>('.report-card');
  if (!card || card.dataset.approved === '1') return;
  const title = card.querySelector('h2')?.textContent || '';
  const pattern: ResultPattern = title.includes('MEDO') ? 'MEDO' : title.includes('INSEGURANÇA') ? 'INSEGURANÇA' : 'PROCRASTINAÇÃO';
  const greeting = Array.from(card.querySelectorAll('p')).find(p => p.textContent?.trim().startsWith('Olá,'))?.textContent || 'Olá.';
  const name = greeting.replace(/^Olá,\s*/, '').replace(/\.$/, '');
  const message = `Olá, Janaína! Meu nome é ${name} e meu padrão predominante foi ${pattern}.\n\nFiz o Mini Diagnóstico e gostaria de aprofundar meu resultado: ${pattern}.\n\nVim pelo Mini Diagnóstico — Janaína Araújo.`;
  const pdf = artwork[pattern];
  const whatsapp = `https://api.whatsapp.com/send?phone=5521983928113&text=${encodeURIComponent(message)}`;

  card.dataset.approved = '1';
  card.dataset.pattern = pattern;
  card.innerHTML = `<div class="approved-artwork-result"><canvas class="approved-artwork" aria-label="Resultado ${pattern}"></canvas><a class="artwork-fallback" href="${pdf}" target="_blank" rel="noopener noreferrer" hidden>Abrir resultado ${pattern}</a><a class="artwork-hotspot artwork-whatsapp" href="${whatsapp}" target="_blank" rel="noopener noreferrer" aria-label="Quero aprofundar meu resultado com Janaína"></a><button class="artwork-hotspot artwork-pdf" type="button" aria-label="Baixar meu resultado em PDF"></button></div>`;
  const canvas = card.querySelector<HTMLCanvasElement>('.approved-artwork');
  if (canvas) void renderPdf(canvas, pdf);
  const download = card.querySelector<HTMLButtonElement>('.artwork-pdf');
  download?.addEventListener('click', () => {
    void downloadPdf(pdf, pattern).catch((error) => {
      console.error(error);
      window.location.href = pdf;
    });
  });
}

new MutationObserver(enhance).observe(document.documentElement, { childList: true, subtree: true });
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', enhance);
else enhance();
