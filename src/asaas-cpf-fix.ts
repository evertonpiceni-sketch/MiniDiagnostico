const onlyDigits = (value: string) => value.replace(/\D/g, '');

function validCpf(value: string) {
  const cpf = onlyDigits(value);
  if (!/^\d{11}$/.test(cpf) || /^(\d)\1{10}$/.test(cpf)) return false;
  const calc = (length: number) => {
    let sum = 0;
    for (let i = 0; i < length; i++) sum += Number(cpf[i]) * (length + 1 - i);
    const r = (sum * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return calc(9) === Number(cpf[9]) && calc(10) === Number(cpf[10]);
}

function installAsaasCpfGuard() {
  if (typeof window === 'undefined' || typeof window.fetch !== 'function') return;
  const marker = '__miniDiagnosticoAsaasCpfGuard';
  if ((window as Window & { [marker]?: boolean })[marker]) return;

  const originalFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const request = new Request(input, init);
    const url = new URL(request.url, window.location.href);
    if (request.method.toUpperCase() !== 'POST' || url.pathname !== '/api/asaas-pix') {
      return originalFetch(input, init);
    }

    let parsed: Record<string, unknown> = {};
    try {
      if (typeof init?.body === 'string') parsed = JSON.parse(init.body);
    } catch {
      // Let the backend handle malformed payloads.
    }

    if (!parsed.cpfCnpj) {
      let cpf = '';
      while (true) {
        const value = window.prompt('Para gerar o PIX pelo Asaas, informe o CPF do pagador (somente números):');
        if (value === null) {
          return new Response(JSON.stringify({ error: 'Geração do PIX cancelada.' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        cpf = onlyDigits(value);
        if (validCpf(cpf)) break;
        window.alert('CPF inválido. Confira os 11 números e tente novamente.');
      }
      parsed.cpfCnpj = cpf;
    }

    return originalFetch(input, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
      body: JSON.stringify(parsed),
    });
  };

  (window as Window & { [marker]?: boolean })[marker] = true;
}

installAsaasCpfGuard();
