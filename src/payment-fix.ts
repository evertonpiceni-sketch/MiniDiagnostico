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
  } catch {}
};

const beginPixPolling = (sessionId: string, token: string) => {
  stopPixPolling();
  void verifyPixPayment(sessionId, token);
  pixPollTimer = window.setInterval(() => void verifyPixPayment(sessionId, token), 3000);
  window.setTimeout(stopPixPolling, 15 * 60 * 1000);
};

const normalizeCpf = (value: string) => value.replace(/\D/g, '');

const requestAsaasPix = async (sessionId: string, cpfCnpj: string) => {
  const response = await fetch('/api/asaas-pix', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ quiz_session_id: sessionId, cpfCnpj }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof data?.error === 'string' ? data.error : `Não foi possível gerar o PIX (HTTP ${response.status}).`);
  return data as { paid?: boolean; token?: string; payload?: string; encodedImage?: string; expirationDate?: string | null; };
};

const renderPixQr = (root: HTMLElement, sessionId: string, data: Awaited<ReturnType<typeof requestAsaasPix>>) => {
  const token = String(data.token || '');
  const payload = String(data.payload || '');
  const encodedImage = String(data.encodedImage || '');
  if (!token || !payload || !/^[A-Za-z0-9+/=\r\n]+$/.test(encodedImage)) throw new Error('O provedor de pagamento retornou um PIX inválido.');
  root.innerHTML = `<div class="space-y-4 text-center"><div class="bg-emerald-50 border border-emerald-200 rounded-xl p-5"><div class="text-sm font-bold text-emerald-900 mb-2">PIX • R$ 9,90</div><p class="text-xs text-emerald-800 leading-relaxed">Escaneie o QR Code ou use o código Copia e Cola. A liberação é automática após a confirmação do pagamento.</p></div><div class="flex justify-center"><img id="asaas-pix-qr" alt="QR Code PIX" class="w-56 h-56 rounded-xl bg-white p-3" /></div><textarea id="asaas-pix-payload" readonly class="w-full min-h-24 rounded-xl border p-3 text-xs break-all"></textarea><button id="btn-copiar-pix-asaas" type="button" class="w-full py-4 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-sm transition-all active:scale-[0.99] cursor-pointer text-sm">COPIAR CÓDIGO PIX</button><p id="asaas-pix-status" class="text-[11px] text-stone-500">Aguardando confirmação automática do pagamento...</p></div>`;
  const image = document.getElementById('asaas-pix-qr') as HTMLImageElement | null;
  const textarea = document.getElementById('asaas-pix-payload') as HTMLTextAreaElement | null;
  const copyButton = document.getElementById('btn-copiar-pix-asaas') as HTMLButtonElement | null;
  if (image) image.src = `data:image/png;base64,${encodedImage.replace(/\s/g, '')}`;
  if (textarea) textarea.value = payload;
  copyButton?.addEventListener('click', async () => { try { await navigator.clipboard.writeText(payload); copyButton.textContent = 'PIX COPIADO ✓'; window.setTimeout(() => { copyButton.textContent = 'COPIAR CÓDIGO PIX'; }, 1800); } catch { textarea?.focus(); textarea?.select(); document.execCommand('copy'); } });
  beginPixPolling(sessionId, token);
};

const startAsaasPix = async (button: HTMLButtonElement, root: HTMLElement) => {
  if (pixInFlight) return;
  const sessionId = getSessionId();
  if (!sessionId) { alert('Sessão do diagnóstico não encontrada. Volte ao início e refaça o diagnóstico.'); return; }
  const cpfField = document.getElementById('pix-cpf') as HTMLInputElement | null;
  const cpfCnpj = normalizeCpf(cpfField?.value || '');
  if (cpfCnpj.length !== 11) { alert('Informe um CPF válido com 11 números para gerar o PIX.'); cpfField?.focus(); return; }
  pixInFlight = true; button.disabled = true;
  const original = button.textContent || 'GERAR PIX (R$ 9,90)'; button.textContent = 'Gerando PIX seguro...';
  try { const data = await requestAsaasPix(sessionId, cpfCnpj); const token = String(data.token || ''); if (data.paid && token) { redirectToResult(sessionId, token); return; } renderPixQr(root, sessionId, data); }
  catch (error) { pixInFlight = false; button.disabled = false; button.textContent = original; alert(error instanceof Error ? error.message : 'Não foi possível gerar o PIX.'); }
};

const replaceManualPix = () => {
  const confirmButton = document.getElementById('btn-confirmar-pix');
  const copyButton = document.getElementById('btn-copiar-pix-inline');
  if (!confirmButton || !copyButton) return;
  let root: HTMLElement | null = confirmButton.parentElement;
  while (root && root.parentElement) { if (root.contains(copyButton) && root.className.includes('space-y-4')) break; root = root.parentElement; }
  if (!root || !root.contains(copyButton) || root.dataset.paymentFixApplied === 'asaas') return;
  root.dataset.paymentFixApplied = 'asaas';
  root.innerHTML = `<div class="space-y-4 text-center"><div class="bg-emerald-50 border border-emerald-200 rounded-xl p-5"><div class="text-sm font-bold text-emerald-900 mb-2">PIX seguro</div><p class="text-xs text-emerald-800 leading-relaxed">Gere um PIX de R$ 9,90 com QR Code e Copia e Cola. A confirmação do pagamento é automática.</p></div><div class="text-left"><label for="pix-cpf" class="block text-sm font-medium mb-1 text-stone-700">CPF do pagador</label><input id="pix-cpf" type="text" inputmode="numeric" autocomplete="off" maxlength="14" placeholder="000.000.000-00" class="w-full border border-stone-200 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-700" /><p class="text-[11px] text-stone-500 mt-1">Necessário apenas para gerar a cobrança PIX. Este CPF não é salvo no diagnóstico.</p></div><button id="btn-pagar-pix-asaas" type="button" class="w-full flex items-center justify-center gap-2 py-4 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-sm transition-all active:scale-[0.99] cursor-pointer text-sm">GERAR PIX (R$ 9,90)</button><p class="text-[11px] text-stone-500">Após pagar, aguarde alguns segundos. Não é necessário enviar comprovante.</p></div>`;
  const cpfField = document.getElementById('pix-cpf') as HTMLInputElement | null;
  cpfField?.addEventListener('input', () => { const digits = normalizeCpf(cpfField.value).slice(0, 11); cpfField.value = digits.replace(/^(\d{3})(\d)/, '$1.$2').replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3').replace(/\.(\d{3})(\d)/, '.$1-$2'); });
  const button = document.getElementById('btn-pagar-pix-asaas') as HTMLButtonElement | null;
  if (button) button.addEventListener('click', () => void startAsaasPix(button, root as HTMLElement));
};

const bootPaymentFix = () => {
  installQuizRequestGuard();
  const staleFloatingLogo = document.body.querySelector(':scope > #mini-diagnostico-brand-logo');
  staleFloatingLogo?.remove();
  const observer = new MutationObserver(() => replaceManualPix());
  observer.observe(document.documentElement, { childList: true, subtree: true });
  replaceManualPix();
};

if (typeof window !== 'undefined') bootPaymentFix();