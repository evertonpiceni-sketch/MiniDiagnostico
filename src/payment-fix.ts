const getSessionId = () => {
  try {
    return new URLSearchParams(window.location.search).get('session_id') || localStorage.getItem('quiz_session_id');
  } catch {
    return null;
  }
};

let checkoutInFlight = false;

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const requestCheckout = async (sessionId: string) => {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quiz_session_id: sessionId }),
      });

      const data = await response.json().catch(() => ({}));
      if (response.ok && typeof data.url === 'string' && data.url) return data.url;

      const message = typeof data?.error === 'string' ? data.error : `Não foi possível iniciar o pagamento (HTTP ${response.status}).`;
      lastError = new Error(message);

      // Vercel/serverless or upstream failures can be transient. Retry once before
      // showing an error to the customer; validation/409/4xx errors are not retried.
      if (attempt === 1 && [408, 429, 500, 502, 503, 504].includes(response.status)) {
        await wait(500);
        continue;
      }
      break;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Não foi possível iniciar o pagamento.');
      if (attempt === 1) {
        await wait(500);
        continue;
      }
    }
  }

  throw lastError || new Error('Não foi possível iniciar o pagamento.');
};

const startStripeCheckout = async (button: HTMLButtonElement) => {
  if (checkoutInFlight) return;

  const sessionId = getSessionId();
  if (!sessionId) {
    alert('Sessão do diagnóstico não encontrada. Volte ao início e refaça o diagnóstico.');
    return;
  }

  checkoutInFlight = true;
  button.disabled = true;
  const original = button.textContent || 'Pagar via PIX';
  button.textContent = 'Abrindo pagamento seguro...';

  try {
    const checkoutUrl = await requestCheckout(sessionId);
    // Keep the loading state while the browser leaves this page. This avoids
    // duplicate requests and misleading error/reset states during navigation.
    window.location.assign(checkoutUrl);
  } catch (error) {
    checkoutInFlight = false;
    button.disabled = false;
    button.textContent = original;
    alert(error instanceof Error ? error.message : 'Não foi possível iniciar o pagamento.');
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
