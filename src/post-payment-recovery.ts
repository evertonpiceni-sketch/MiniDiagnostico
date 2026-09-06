const RECOVERY_URL = 'mini_result_recovery_url';
const RECOVERY_STARTED = 'mini_result_recovery_started';
const RECOVERY_ATTEMPTS = 'mini_result_recovery_attempts';
const MAX_AGE_MS = 90_000;
const MAX_ATTEMPTS = 24;

const now = Date.now();
const path = window.location.pathname;
const params = new URLSearchParams(window.location.search);

const clearRecovery = () => {
  sessionStorage.removeItem(RECOVERY_URL);
  sessionStorage.removeItem(RECOVERY_STARTED);
  sessionStorage.removeItem(RECOVERY_ATTEMPTS);
};

// When Stripe/Asaas sends the customer back to the result route, preserve the
// complete return URL. The backend/webhook can need a few seconds to settle.
if (path.includes('/resultado') && params.get('session_id')) {
  sessionStorage.setItem(RECOVERY_URL, window.location.href);
  if (!sessionStorage.getItem(RECOVERY_STARTED)) {
    sessionStorage.setItem(RECOVERY_STARTED, String(now));
    sessionStorage.setItem(RECOVERY_ATTEMPTS, '0');
  }

  // As soon as React renders the unlocked result, recovery is no longer needed.
  const observer = new MutationObserver(() => {
    if (document.querySelector('.result-card')) {
      clearRecovery();
      observer.disconnect();
    }
  });
  const observe = () => {
    if (document.body) observer.observe(document.body, { childList: true, subtree: true });
  };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', observe, { once: true });
  } else {
    observe();
  }
}

// Older result logic could send a just-paid customer to `/` if the first
// verification happened before payment propagation finished. Return them to
// the preserved result URL instead of losing the session and showing page 1.
if (path === '/') {
  const recoveryUrl = sessionStorage.getItem(RECOVERY_URL);
  const started = Number(sessionStorage.getItem(RECOVERY_STARTED) || '0');
  const attempts = Number(sessionStorage.getItem(RECOVERY_ATTEMPTS) || '0');
  const fresh = recoveryUrl && started > 0 && now - started < MAX_AGE_MS;

  if (fresh && attempts < MAX_ATTEMPTS) {
    sessionStorage.setItem(RECOVERY_ATTEMPTS, String(attempts + 1));
    window.location.replace(recoveryUrl!);
  } else if (recoveryUrl) {
    clearRecovery();
  }
}
