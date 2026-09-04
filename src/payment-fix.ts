import toast from 'react-hot-toast';

let lastErrorToast = '';
let lastErrorToastAt = 0;

const originalToastError = toast.error.bind(toast);
toast.error = ((message: Parameters<typeof originalToastError>[0], options?: Parameters<typeof originalToastError>[1]) => {
  const key = typeof message === 'string' ? message : '';
  const now = Date.now();
  if (key && key === lastErrorToast && now - lastErrorToastAt < 2000) return '';
  lastErrorToast = key;
  lastErrorToastAt = now;
  return originalToastError(message, options);
}) as typeof toast.error;

const getSessionId = () => {
  try {
    return new URLSearchParams(window.location.search).get('session_id') || localStorage.getItem('quiz_session_id');
  } catch {
    return null;
  }
};

type FetchSnapshot = {
  body: string;
  status: number;
  statusText: string;
  headers: [string, string][];
};

const quizRequestCache = new Map<string, Promise<FetchSnapshot>>();

const shouldDeduplicateQuizRequest = (url: URL, method: string) => {
  if (method !== 'POST') return false;
  return /^\/api\/quiz(?:\/[^/]+)?(?:\/verify-payment)?$/.test(url.pathname);
};

const installQuizRequestGuard = () => {
  if (typeof window === 'undefined' || typeof window.fetch !== 'function') return;
  const marker = '__miniDiagnosticoQuizFetchGuard';
  if ((window as Window & { [marker]?: boolean })[marker]) return;

  const originalFetch = window.fetch.bind(window);

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const request = new Request(input, init);
    const url = new URL(request.url, window.location.href);
    const method = request.method.toUpperCase();

    if (!shouldDeduplicateQuizRequest(url, method)) {
      return originalFetch(input, init);
    }

    // The quiz submit is JSON in App.tsx. Identical concurrent submissions share
    // one network request, while each caller receives its own readable Response.
    const body = typeof init?.body === 'string' ? init.body : '';
    const key = `${method}:${url.href}:${body}`;
    const existing = quizRequestCache.get(key);
    if (existing) {
      const snapshot = await existing;
      return new Response(snapshot.body, {
        status: snapshot.status,
        statusText: snapshot.statusText,
        headers: snapshot.headers,
      });
    }

    const shared = originalFetch(input, init).then(async (response) => ({
      body: await response.text(),
      status: response.status,
      statusText: response.statusText,
      headers: Array.from(response.headers.entries()),
    }));

    quizRequestCache.set(key, shared);

    // Keep the completed result briefly so two rapid taps cannot create a second
    // POST even if the first response has already arrived.
    window.setTimeout(() => {
      if (quizRequestCache.get(key) === shared) quizRequestCache.delete(key);
    }, 2000);

    try {
      const snapshot = await shared;
      return new Response(snapshot.body, {
        status: snapshot.status,
        statusText: snapshot.statusText,
        headers: snapshot.headers,
      });
    } catch (error) {
      quizRequestCache.delete(key);
      throw error;
    }
  };

  (window as Window & { [marker]?: boolean })[marker] = true;
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
  installQuizRequestGuard();
  const observer = new MutationObserver(() => replaceManualPix());
  observer.observe(document.documentElement, { childList: true, subtree: true });
  replaceManualPix();
};

if (typeof window !== 'undefined') bootPaymentFix();
