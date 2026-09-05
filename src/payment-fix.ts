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

    if (!shouldDeduplicateQuizRequest(url, method)) return originalFetch(input, init);

    const body = typeof init?.body === 'string' ? init.body : '';
    const key = `${method}:${url.href}:${body}`;
    const existing = quizRequestCache.get(key);
    if (existing) {
      const snapshot = await existing;
      return new Response(snapshot.body, { status: snapshot.status, statusText: snapshot.statusText, headers: snapshot.headers });
    }

    const shared = originalFetch(input, init).then(async (response) => ({
      body: await response.text(),
      status: response.status,
      statusText: response.statusText,
      headers: Array.from(response.headers.entries()),
    }));

    quizRequestCache.set(key, shared);
    window.setTimeout(() => {
      if (quizRequestCache.get(key) === shared) quizRequestCache.delete(key);
    }, 2000);

    try {
      const snapshot = await shared;
      return new Response(snapshot.body, { status: snapshot.status, statusText: snapshot.statusText, headers: snapshot.headers });
    } catch (error) {
      quizRequestCache.delete(key);
      throw error;
    }
  };

  (window as Window & { [marker]?: boolean })[marker] = true;
};

const installBrandLogo = () => {
  if (typeof document === 'undefined') return;
  const marker = 'mini-diagnostico-brand-logo';
  if (document.getElementById(marker)) return;

  const logo = document.createElement('img');
  logo.id = marker;
  logo.src = '/ja-logo.webp';
  logo.alt = 'Janaína Araújo';
  logo.style.cssText = [
    'position:fixed', 'top:12px', 'left:50%', 'transform:translateX(-50%)',
    'width:92px', 'height:92px', 'object-fit:cover', 'border-radius:50%',
    'z-index:40', 'pointer-events:none', 'background:#050505',
    'border:1px solid rgba(242,201,120,.5)',
    'box-shadow:0 12px 38px rgba(0,0,0,.5),0 0 30px rgba(217,170,85,.08)',
  ].join(';');
  document.body.appendChild(logo);
};

let pixInFlight = false;
let pixPollTimer: number | null = null;

const stopPixPolling = () => {
  if (pixPollTimer !== null) window.clearInterval(pixPollTimer);
  pixPollTimer = null;
};

const redirectToResult = (sessionId: string, token: string) => {
  stopPixPolling();
  window.location.assign(`/resultado?session_id=${encodeURIComponent(sessionId)}&token=${encodeURIComponent(token)}`);
};

const verifyPixPayment = async (sessionId: string, token: string) => {
  try {
    const response = await fetch(`/api/quiz/${encodeURIComponent(sessionId)}/verify-payment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });
    const data = await response.json().catch(() => ({}));
    if (response.ok && data?.payment_status === 'paid') redirectToResult(sessionId, token);
  } catch {
    // Polling is best-effort; the next interval retries automatically.
  }
};

const beginPixPolling = (sessionId: string, token: string) => {
  stopPixPolling();
  void verifyPixPayment(sessionId, token);
  pixPollTimer = window.setInterval(() => void verifyPixPayment(sessionId, token), 3000);
  window.setTimeout(stopPixPolling, 15 * 60 * 1000);
};

const requestAsaasPix = async (sessionId: string) => {
  const response = await fetch('/api/asaas-pix', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ quiz_session_id: sessionId }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof data?.error === 'string' ? data.error : `Não foi possível gerar o PIX (HTTP ${response.status}).`);
  return data as {
    paid?: boolean;
    token?: string;
    payload?: string;
    encodedImage?: string;
    expirationDate?: string | null;
  };
};

const renderPixQr = (root: HTMLElement, sessionId: string, data: Awaited<ReturnType<typeof requestAsaasPix>>) => {
  const token = String(data.token || '');
  const payload = String(data.payload || '');
  const encodedImage = String(data.encodedImage || '');
  if (!token || !payload || !/^[A-Za-z0-9+/=\r\n]+$/.test(encodedImage)) throw new Error('O Asaas retornou um PIX inválido.');

  root.innerHTML = `
    <div class="space-y-4 text-center">
      <div class="bg-emerald-50 border border-emerald-200 rounded-xl p-5">
        <div class="text-sm font-bold text-emerald-900 mb-2">PIX via Asaas • R$ 9,90</div>
        <p class="text-xs text-emerald-800 leading-relaxed">Escaneie o QR Code ou use o código Copia e Cola. A liberação é automática após a confirmação do pagamento.</p>
      </div>
      <div class="flex justify-center"><img id="asaas-pix-qr" alt="QR Code PIX" class="w-56 h-56 rounded-xl bg-white p-3" /></div>
      <textarea id="asaas-pix-payload" readonly class="w-full min-h-24 rounded-xl border p-3 text-xs break-all"></textarea>
      <button id="btn-copiar-pix-asaas" type="button" class="w-full py-4 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-sm transition-all active:scale-[0.99] cursor-pointer text-sm">COPIAR CÓDIGO PIX</button>
      <p id="asaas-pix-status" class="text-[11px] text-stone-500">Aguardando confirmação automática do Asaas...</p>
    </div>
  `;

  const image = document.getElementById('asaas-pix-qr') as HTMLImageElement | null;
  const textarea = document.getElementById('asaas-pix-payload') as HTMLTextAreaElement | null;
  const copyButton = document.getElementById('btn-copiar-pix-asaas') as HTMLButtonElement | null;
  if (image) image.src = `data:image/png;base64,${encodedImage.replace(/\s/g, '')}`;
  if (textarea) textarea.value = payload;
  copyButton?.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(payload);
      copyButton.textContent = 'PIX COPIADO ✓';
      window.setTimeout(() => { copyButton.textContent = 'COPIAR CÓDIGO PIX'; }, 1800);
    } catch {
      textarea?.focus();
      textarea?.select();
      document.execCommand('copy');
    }
  });

  beginPixPolling(sessionId, token);
};

const startAsaasPix = async (button: HTMLButtonElement, root: HTMLElement) => {
  if (pixInFlight) return;
  const sessionId = getSessionId();
  if (!sessionId) {
    alert('Sessão do diagnóstico não encontrada. Volte ao início e refaça o diagnóstico.');
    return;
  }

  pixInFlight = true;
  button.disabled = true;
  const original = button.textContent || 'GERAR PIX (R$ 9,90)';
  button.textContent = 'Gerando PIX seguro...';

  try {
    const data = await requestAsaasPix(sessionId);
    const token = String(data.token || '');
    if (data.paid && token) {
      redirectToResult(sessionId, token);
      return;
    }
    renderPixQr(root, sessionId, data);
  } catch (error) {
    pixInFlight = false;
    button.disabled = false;
    button.textContent = original;
    alert(error instanceof Error ? error.message : 'Não foi possível gerar o PIX.');
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
  if (root.dataset.paymentFixApplied === 'asaas') return;

  root.dataset.paymentFixApplied = 'asaas';
  root.innerHTML = `
    <div class="space-y-4 text-center">
      <div class="bg-emerald-50 border border-emerald-200 rounded-xl p-5">
        <div class="text-sm font-bold text-emerald-900 mb-2">PIX seguro pelo Asaas</div>
        <p class="text-xs text-emerald-800 leading-relaxed">Gere um PIX de R$ 9,90 com QR Code e Copia e Cola. O cartão continua sendo processado pela Stripe.</p>
      </div>
      <button id="btn-pagar-pix-asaas" type="button" class="w-full flex items-center justify-center gap-2 py-4 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-sm transition-all active:scale-[0.99] cursor-pointer text-sm">GERAR PIX (R$ 9,90)</button>
      <p class="text-[11px] text-stone-500">Após pagar, aguarde alguns segundos. Não é necessário enviar comprovante.</p>
    </div>
  `;

  const button = document.getElementById('btn-pagar-pix-asaas') as HTMLButtonElement | null;
  if (button) button.addEventListener('click', () => void startAsaasPix(button, root as HTMLElement));
};

const bootPaymentFix = () => {
  installQuizRequestGuard();
  installBrandLogo();
  const observer = new MutationObserver(() => {
    installBrandLogo();
    replaceManualPix();
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
  replaceManualPix();
};

if (typeof window !== 'undefined') bootPaymentFix();
