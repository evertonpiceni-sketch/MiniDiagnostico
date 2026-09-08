const enhanceApprovedLanding = () => {
  const card = document.querySelector<HTMLElement>('.brand-start-card');
  if (!card || card.dataset.approvedLandingReady === '1') return;
  card.dataset.approvedLandingReady = '1';

  const openForm = () => {
    card.classList.add('collecting-data');
    window.setTimeout(() => card.querySelector<HTMLInputElement>('input')?.focus(), 50);
  };

  const primary = document.createElement('button');
  primary.type = 'button';
  primary.className = 'approved-cta-hotspot';
  primary.setAttribute('aria-label', 'Iniciar meu diagnóstico');
  primary.addEventListener('click', openForm);

  const top = document.createElement('button');
  top.type = 'button';
  top.className = 'approved-top-hotspot';
  top.setAttribute('aria-label', 'Começar');
  top.addEventListener('click', openForm);

  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'approved-close';
  close.setAttribute('aria-label', 'Fechar formulário');
  close.textContent = '×';
  close.addEventListener('click', () => card.classList.remove('collecting-data'));

  card.append(primary, top, close);
};

const observer = new MutationObserver(enhanceApprovedLanding);
observer.observe(document.documentElement, { childList: true, subtree: true });
window.addEventListener('DOMContentLoaded', enhanceApprovedLanding);
enhanceApprovedLanding();
