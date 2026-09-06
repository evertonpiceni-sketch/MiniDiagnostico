const RESULT_SESSION_KEY = 'mini_paid_result_session';

type StoredResultSession = {
  sessionId: string;
  token: string;
  savedAt: number;
};

const readStored = (): StoredResultSession | null => {
  try {
    const raw = localStorage.getItem(RESULT_SESSION_KEY) || sessionStorage.getItem(RESULT_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredResultSession;
    if (!parsed?.sessionId || !parsed?.token) return null;
    return parsed;
  } catch {
    return null;
  }
};

const saveStored = (sessionId: string, token: string) => {
  if (!sessionId || !token) return;
  const value = JSON.stringify({ sessionId, token, savedAt: Date.now() });
  try { localStorage.setItem(RESULT_SESSION_KEY, value); } catch {}
  try { sessionStorage.setItem(RESULT_SESSION_KEY, value); } catch {}
  try { sessionStorage.setItem('result_token', token); } catch {}
  try { localStorage.setItem('quiz_session_id', sessionId); } catch {}
};

const sleep = (ms: number) => new Promise(resolve => window.setTimeout(resolve, ms));

if (typeof window !== 'undefined') {
  const params = new URLSearchParams(window.location.search);
  const urlSessionId = params.get('session_id') || '';
  const urlToken = params.get('token') || '';
  if (urlSessionId && urlToken) saveStored(urlSessionId, urlToken);

  const nativeFetch = window.fetch.bind(window);

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    let requestUrl = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    const method = String(init?.method || (input instanceof Request ? input.method : 'GET')).toUpperCase();

    // Persist the access token returned when an Asaas PIX is generated.
    if (requestUrl.includes('/api/asaas-pix') && method === 'POST') {
      const response = await nativeFetch(input, init);
      try {
        const body = typeof init?.body === 'string' ? JSON.parse(init.body) : {};
        const data = await response.clone().json();
        const sessionId = String(body?.quiz_session_id || '');
        const token = String(data?.token || '');
        if (response.ok && sessionId && token) saveStored(sessionId, token);
      } catch {}
      return response;
    }

    const resultMatch = requestUrl.match(/\/api\/quiz\/([0-9a-f-]{36})(?:\?|$)/i);
    const isResultGet = method === 'GET' && Boolean(resultMatch) && !requestUrl.includes('/verify-payment');

    if (isResultGet && resultMatch) {
      const sessionId = resultMatch[1];
      const stored = readStored();
      const url = new URL(requestUrl, window.location.origin);
      const tokenInUrl = url.searchParams.get('token') || '';

      if ((!tokenInUrl || tokenInUrl !== stored?.token) && stored?.sessionId === sessionId && stored.token) {
        url.searchParams.set('token', stored.token);
        requestUrl = url.pathname + url.search;
        input = requestUrl;
      } else if (tokenInUrl) {
        saveStored(sessionId, tokenInUrl);
      }

      // After a confirmed payment the webhook/database update can take a few
      // seconds to become visible to the result GET. Keep the user on the
      // loading screen and retry instead of returning a false "not paid".
      const deadline = Date.now() + 45_000;
      let lastResponse: Response | null = null;

      do {
        const response = await nativeFetch(input, init);
        lastResponse = response;
        try {
          const data = await response.clone().json();
          if (response.ok && data?.payment_status === 'paid') return response;
          if (response.status === 403) {
            const latest = readStored();
            if (latest?.sessionId === sessionId && latest.token) {
              const retryUrl = new URL(requestUrl, window.location.origin);
              retryUrl.searchParams.set('token', latest.token);
              requestUrl = retryUrl.pathname + retryUrl.search;
              input = requestUrl;
            }
          }
        } catch {
          return response;
        }

        if (!window.location.pathname.includes('/resultado')) return response;
        await sleep(1500);
      } while (Date.now() < deadline);

      return lastResponse || nativeFetch(input, init);
    }

    const verifyMatch = requestUrl.match(/\/api\/quiz\/([0-9a-f-]{36})\/verify-payment/i);
    if (method === 'POST' && verifyMatch) {
      const sessionId = verifyMatch[1];
      try {
        const parsed = typeof init?.body === 'string' ? JSON.parse(init.body) : {};
        const token = String(parsed?.token || '');
        if (token) saveStored(sessionId, token);
      } catch {}
    }

    return nativeFetch(input, init);
  };
}
