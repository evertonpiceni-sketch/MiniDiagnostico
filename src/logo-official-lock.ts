const OFFICIAL_LOGO = '/result-assets/ja-logo-everton-approved.svg';
const LEGACY_LOGOS = [
  '/ja-logo-approved.webp',
  '/ja-logo.webp',
  '/result-assets/logo-reference.png',
  '/result-assets/medo-logo-approved.png',
  '/result-assets/ja-logo-top-transparent.svg',
  '/result-assets/ja-logo-everton-approved.svg',
];

function normalizeLogo(image: HTMLImageElement) {
  const src = image.getAttribute('src') || '';
  if (!LEGACY_LOGOS.some(path => src.endsWith(path))) return;
  if (src !== OFFICIAL_LOGO) image.src = OFFICIAL_LOGO;
  image.removeAttribute('srcset');
}

function lockOfficialLogoEverywhere() {
  document.querySelectorAll<HTMLImageElement>('img').forEach(normalizeLogo);
}

new MutationObserver(lockOfficialLogoEverywhere).observe(document.documentElement, {
  childList: true,
  subtree: true,
  attributes: true,
  attributeFilter: ['src', 'srcset'],
});

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', lockOfficialLogoEverywhere, { once: true });
} else {
  lockOfficialLogoEverywhere();
}
