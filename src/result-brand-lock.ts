const APPROVED_RESULT_LOGO = '/result-assets/logo-reference.png';

function lockApprovedResultLogo() {
  document
    .querySelectorAll<HTMLImageElement>('.report-card[data-approved="1"] .result-brand > img, .report-card[data-approved="1"] .result-footer > img')
    .forEach((image) => {
      if (image.getAttribute('src') !== APPROVED_RESULT_LOGO) {
        image.src = APPROVED_RESULT_LOGO;
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
