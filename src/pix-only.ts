const enforcePixOnly = () => {
  const pixTab = document.getElementById('tab-pix') as HTMLButtonElement | null;
  const cardTab = document.getElementById('tab-card') as HTMLButtonElement | null;

  // Always switch React back to PIX before hiding the card option.
  if (pixTab && cardTab && cardTab.className.includes('payment-tab-active')) {
    pixTab.click();
  }

  // Hide only the card tab. Do not remove payment containers from the DOM:
  // React owns those nodes and removing an ancestor can blank the whole screen.
  if (cardTab) {
    cardTab.style.display = 'none';
    cardTab.setAttribute('aria-hidden', 'true');
    cardTab.tabIndex = -1;
  }

  if (pixTab) {
    pixTab.style.display = 'flex';
    pixTab.style.width = '100%';
    pixTab.style.flex = '1 1 100%';
    pixTab.setAttribute('aria-label', 'PIX via Asaas — R$ 9,90');
    const label = pixTab.querySelector('span');
    if (label) label.textContent = 'PIX • R$ 9,90';
  }

  // If the card panel was rendered, hide only that panel. Never remove it.
  const stripeButton = document.getElementById('btn-pagar-cartao-stripe');
  if (stripeButton) {
    const cardPanel = stripeButton.closest('.space-y-4') as HTMLElement | null;
    if (cardPanel) {
      cardPanel.style.display = 'none';
      cardPanel.setAttribute('aria-hidden', 'true');
    }
  }
};

const bootPixOnly = () => {
  if (typeof window === 'undefined') return;
  const observer = new MutationObserver(enforcePixOnly);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  enforcePixOnly();
};

bootPixOnly();
