const PDF_APPROVED_LOGO = '/result-assets/ja-logo-everton-approved.svg';

function snapshotImage(image: HTMLImageElement) {
  return {
    src: image.getAttribute('src'),
    srcset: image.getAttribute('srcset'),
    filter: image.style.filter,
    mixBlendMode: image.style.mixBlendMode,
    background: image.style.background,
  };
}

function restoreImage(image: HTMLImageElement, snapshot: ReturnType<typeof snapshotImage>) {
  if (snapshot.src == null) image.removeAttribute('src');
  else image.setAttribute('src', snapshot.src);
  if (snapshot.srcset == null) image.removeAttribute('srcset');
  else image.setAttribute('srcset', snapshot.srcset);
  image.style.filter = snapshot.filter;
  image.style.mixBlendMode = snapshot.mixBlendMode;
  image.style.background = snapshot.background;
}

// PDF only: swap the top and footer logos immediately before the existing PDF capture.
// No text, layout, spacing, typography, colors or figures are changed.
document.addEventListener('click', event => {
  const target = event.target as Element | null;
  const download = target?.closest?.('.report-card[data-approved="1"] .result-download');
  if (!download) return;

  const card = download.closest('.report-card[data-approved="1"]');
  if (!card) return;

  const logos = [
    card.querySelector<HTMLImageElement>('.result-brand > img'),
    card.querySelector<HTMLImageElement>('.result-footer > img'),
  ].filter((image): image is HTMLImageElement => Boolean(image));

  if (!logos.length) return;

  const snapshots = logos.map(image => ({ image, snapshot: snapshotImage(image) }));
  logos.forEach(image => {
    image.src = PDF_APPROVED_LOGO;
    image.removeAttribute('srcset');
    image.style.filter = 'none';
    image.style.mixBlendMode = 'normal';
    image.style.background = 'transparent';
  });

  window.setTimeout(() => {
    snapshots.forEach(({ image, snapshot }) => restoreImage(image, snapshot));
  }, 8000);
}, true);
