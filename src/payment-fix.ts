const getSessionId = () => {
  try {
    return new URLSearchParams(window.location.search).get('session_id') || localStorage.getItem('quiz_session_id');
  } catch {
    return null;
  }
};

const startStripeCheckout = async (button: HTMLButtonElement) => {
  const sessionId = getSessionId();
  if (!sessionId) {
    alert('Sessão do diagnóstico não encontrada. Volte ao início e refaça o diagnóstico.');
    return;
  }

  button.disabled = true;
  const original = button.textContent || 'Pagar via PIX';
  button.textContent = 'Abrindo pagamento seguro...';

  try {
    const response = await fetch('/api/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quiz_session_id: sessionId }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.url) throw new Error(data.error || 'Não foi possível iniciar o pagamento.');
    window.location.href = data.url;
  } catch (error) {
    alert(error instanceof Error ? error.message : 'Não foi possível iniciar o pagamento.');
    button.disabled = false;
    button.textContent = original;
  }
};

const replaceManualPix = () => {
  const confirmButton = document.getElementById('btn-confirmar-pix');
  const copyButton = document.getElementById('btn-copiar-pix-inline');
  if (!confirmButton || !copyButton) return;

  let root: HTMLElement | null = confirmButton.parentElement;
  while (root && root.parentElement) {
    if (root.contains(copyButton) && root.className.includes('space-y-4')) break;
    root = root.parentElement;
  }
  if (!root || !root.contains(copyButton)) return;
  if (root.dataset.paymentFixApplied === 'true') return;

  root.dataset.paymentFixApplied = 'true';
  root.innerHTML = `
    <div class="space-y-4 text-center">
      <div class="bg-emerald-50 border border-emerald-200 rounded-xl p-5">
        <div class="text-sm font-bold text-emerald-900 mb-2">PIX seguro pela Stripe</div>
        <p class="text-xs text-emerald-800 leading-relaxed">
          Gere seu pagamento PIX dentro do Checkout da Stripe. Assim o pagamento fica vinculado ao seu diagnóstico e a liberação pode ser confirmada automaticamente.
        </p>
      </div>
      <button
        id="btn-pagar-pix-stripe"
        type="button"
        class="w-full flex items-center justify-center gap-2 py-4 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-sm transition-all active:scale-[0.99] cursor-pointer text-sm"
      >
        PAGAR COM PIX (R$ 9,90)
      </button>
      <p class="text-[11px] text-stone-500">
        Após o pagamento, aguarde a confirmação automática. Não é necessário enviar comprovante nem clicar em “já fiz o PIX”.
      </p>
    </div>
  `;

  const button = document.getElementById('btn-pagar-pix-stripe') as HTMLButtonElement | null;
  button?.addEventListener('click', () => startStripeCheckout(button));
};

const bootPaymentFix = () => {
  const observer = new MutationObserver(() => replaceManualPix());
  observer.observe(document.documentElement, { childList: true, subtree: true });
  replaceManualPix();
};

if (typeof window !== 'undefined') bootPaymentFix();
