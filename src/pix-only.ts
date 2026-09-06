const enforcePixOnly = () => {
  const pixTab = document.getElementById('tab-pix') as HTMLButtonElement | null;
  const cardTab = document.getElementById('tab-card') as HTMLButtonElement | null;

  if (cardTab) {
    if (cardTab.className.includes('payment-tab-active')) {
      pixTab?.click();
    }
    cardTab.remove();
  }

  if (pixTab) {
    pixTab.style.width = '100%';
    pixTab.style.flex = '1 1 100%';
    pixTab.setAttribute('aria-label', 'PIX via Asaas — R$ 9,90');
    const label = pixTab.querySelector('span');
    if (label) label.textContent = 'PIX • R$ 9,90';
  }

  const stripeButton = document.getElementById('btn-pagar-cartao-stripe');
  if (stripeButton) {
    pixTab?.click();
    const cardPanel = stripeButton.closest('.space-y-4');
    cardPanel?.remove();
  }

  const paymentCard = document.querySelector('.payment-card') as HTMLElement | null;
  if (!paymentCard) return;

  paymentCard.querySelectorAll('*').forEach((node) => {
    const text = node.textContent || '';
    if (/stripe|cart[aã]o de cr[eé]dito/i.test(text) && !node.querySelector('*')) {
      const parent = node.closest('.space-y-4');
      if (parent && paymentCard.contains(parent)) parent.remove();
    }
  });
};

const bootPixOnly = () => {
  if (typeof window === 'undefined') return;
  const observer = new MutationObserver(enforcePixOnly);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  enforcePixOnly();
};

bootPixOnly();
