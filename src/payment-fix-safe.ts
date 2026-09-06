const getSessionId = () => {
  try {
    return new URLSearchParams(window.location.search).get('session_id') || localStorage.getItem('quiz_session_id');
  } catch {
    return null;
  }
};

const onlyDigits = (value: string) => value.replace(/\D/g, '');
let pixPollTimer: number | null = null;
let applying = false;

const stopPolling = () => {
  if (pixPollTimer !== null) window.clearInterval(pixPollTimer);
  pixPollTimer = null;
};

const verifyPayment = async (sessionId: string, token: string) => {
  try {
    const response = await fetch(`/api/quiz/${encodeURIComponent(sessionId)}/verify-payment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });
    const data = await response.json().catch(() => ({}));
    if (response.ok && data?.payment_status === 'paid') {
      stopPolling();
      window.location.assign(`/resultado?session_id=${encodeURIComponent(sessionId)}&token=${encodeURIComponent(token)}`);
    }
  } catch {
    // A próxima tentativa automática cuida de falhas transitórias.
  }
};

const startPolling = (sessionId: string, token: string) => {
  stopPolling();
  void verifyPayment(sessionId, token);
  pixPollTimer = window.setInterval(() => void verifyPayment(sessionId, token), 3000);
  window.setTimeout(stopPolling, 15 * 60 * 1000);
};

const protectPendingResult = () => {
  const preview = document.querySelector('.payment-card .result-preview') as HTMLElement | null;
  if (!preview || preview.dataset.lockedPreview === '1') return;
  preview.dataset.lockedPreview = '1';
  try { localStorage.removeItem('janaina_resultado'); } catch {}
  preview.innerHTML = '<span>✦</span><small>Seu resultado já foi identificado</small><strong>Resultado confidencial</strong><p style="margin:.35rem 0 0;font-size:.78rem;color:#657069;text-align:center">Seu padrão predominante foi identificado. Conclua o pagamento para desbloquear o diagnóstico completo.</p>';
};

const renderPix = (root: HTMLElement, sessionId: string, data: any) => {
  const token = String(data?.token || '');
  const payload = String(data?.payload || '');
  const encodedImage = String(data?.encodedImage || '').replace(/\s/g, '');
  if (!token || !payload || !encodedImage) throw new Error('O Asaas não retornou um PIX válido.');

  root.dataset.asaasReady = '1';
  root.innerHTML = `
    <div class="space-y-4 text-center">
      <div class="bg-emerald-50 border border-emerald-200 rounded-xl p-5">
        <div class="text-sm font-bold text-emerald-900 mb-2">PIX • R$ 9,90</div>
        <p class="text-xs text-emerald-800 leading-relaxed">Escaneie o QR Code ou use o Copia e Cola. A liberação ocorre automaticamente após a confirmação.</p>
      </div>
      <div class="flex justify-center"><img id="asaas-pix-qr" alt="QR Code PIX" class="w-56 h-56 rounded-xl bg-white p-3" /></div>
      <textarea id="asaas-pix-payload" readonly class="w-full min-h-24 rounded-xl border p-3 text-xs break-all"></textarea>
      <button id="btn-copiar-pix-asaas" type="button" class="w-full py-4 px-4 bg-emerald-600 text-white font-bold rounded-xl">COPIAR CÓDIGO PIX</button>
      <p class="text-[11px] text-stone-500">Aguardando confirmação automática do pagamento...</p>
    </div>`;

  const image = root.querySelector('#asaas-pix-qr') as HTMLImageElement | null;
  const textarea = root.querySelector('#asaas-pix-payload') as HTMLTextAreaElement | null;
  const copyButton = root.querySelector('#btn-copiar-pix-asaas') as HTMLButtonElement | null;
  if (image) image.src = `data:image/png;base64,${encodedImage}`;
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
  startPolling(sessionId, token);
};

const installPixUi = () => {
  const confirmButton = document.getElementById('btn-confirmar-pix');
  const copyButton = document.getElementById('btn-copiar-pix-inline');
  if (!confirmButton || !copyButton) return;

  let root: HTMLElement | null = confirmButton.parentElement;
  while (root?.parentElement) {
    if (root.contains(copyButton) && root.className.includes('space-y-4')) break;
    root = root.parentElement;
  }
  if (!root || !root.contains(copyButton) || root.dataset.asaasReady === '1') return;

  root.dataset.asaasReady = '1';
  root.innerHTML = `
    <div class="space-y-4 text-center">
      <div class="bg-emerald-50 border border-emerald-200 rounded-xl p-5">
        <div class="text-sm font-bold text-emerald-900 mb-2">PIX seguro</div>
        <p class="text-xs text-emerald-800 leading-relaxed">Gere um PIX de R$ 9,90 com QR Code e Copia e Cola. A confirmação é automática.</p>
      </div>
      <div class="text-left">
        <label for="pix-cpf" class="block text-sm font-medium mb-1 text-stone-700">CPF do pagador</label>
        <input id="pix-cpf" type="text" inputmode="numeric" maxlength="14" placeholder="000.000.000-00" class="w-full border border-stone-200 rounded-lg px-4 py-3" />
      </div>
      <button id="btn-pagar-pix-asaas" type="button" class="w-full py-4 px-4 bg-emerald-600 text-white font-bold rounded-xl">GERAR PIX (R$ 9,90)</button>
      <p class="text-[11px] text-stone-500">Após pagar, aguarde alguns segundos. Não é necessário enviar comprovante.</p>
    </div>`;

  const cpf = root.querySelector('#pix-cpf') as HTMLInputElement | null;
  const pay = root.querySelector('#btn-pagar-pix-asaas') as HTMLButtonElement | null;
  cpf?.addEventListener('input', () => {
    const digits = onlyDigits(cpf.value).slice(0, 11);
    cpf.value = digits.replace(/^(\d{3})(\d)/, '$1.$2').replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3').replace(/\.(\d{3})(\d)/, '.$1-$2');
  });

  pay?.addEventListener('click', async () => {
    const sessionId = getSessionId();
    const cpfCnpj = onlyDigits(cpf?.value || '');
    if (!sessionId) return window.alert('Sessão do diagnóstico não encontrada. Refaça o diagnóstico.');
    if (cpfCnpj.length !== 11) return window.alert('Informe um CPF válido com 11 números.');

    pay.disabled = true;
    const original = pay.textContent || 'GERAR PIX (R$ 9,90)';
    pay.textContent = 'Gerando PIX seguro...';
    try {
      const response = await fetch('/api/asaas-pix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quiz_session_id: sessionId, cpfCnpj }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error || 'Não foi possível gerar o PIX.');
      if (data?.paid && data?.token) {
        window.location.assign(`/resultado?session_id=${encodeURIComponent(sessionId)}&token=${encodeURIComponent(String(data.token))}`);
        return;
      }
      renderPix(root as HTMLElement, sessionId, data);
    } catch (error) {
      pay.disabled = false;
      pay.textContent = original;
      window.alert(error instanceof Error ? error.message : 'Não foi possível gerar o PIX.');
    }
  });
};

const apply = () => {
  if (applying) return;
  applying = true;
  try {
    protectPendingResult();
    installPixUi();
  } finally {
    applying = false;
  }
};

if (typeof window !== 'undefined') {
  let scheduled = false;
  const scheduleApply = () => {
    if (scheduled) return;
    scheduled = true;
    window.requestAnimationFrame(() => {
      scheduled = false;
      apply();
    });
  };
  new MutationObserver(scheduleApply).observe(document.documentElement, { childList: true, subtree: true });
  scheduleApply();
}
