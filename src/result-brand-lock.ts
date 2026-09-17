const APPROVED_TOP_LOGO = '/result-assets/ja-logo-everton-approved.svg';
const APPROVED_FOOTER_LOGO = '/result-assets/ja-logo-everton-approved.svg';

function lockApprovedResultLogo() {
  document
    .querySelectorAll<HTMLImageElement>('.report-card[data-approved="1"] .result-brand > img')
    .forEach((image) => {
      if (image.getAttribute('src') !== APPROVED_TOP_LOGO) {
        image.src = APPROVED_TOP_LOGO;
      }
      image.removeAttribute('srcset');
    });

  document
    .querySelectorAll<HTMLImageElement>('.report-card[data-approved="1"] .result-footer > img')
    .forEach((image) => {
      if (image.getAttribute('src') !== APPROVED_FOOTER_LOGO) {
        image.src = APPROVED_FOOTER_LOGO;
      }
      image.removeAttribute('srcset');
    });
}

new MutationObserver(lockApprovedResultLogo).observe(document.documentElement, {
  childList: true,
  subtree: true,
});

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', lockApprovedResultLogo, { once: true });
} else {
  lockApprovedResultLogo();
}
