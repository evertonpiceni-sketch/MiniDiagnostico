const RECOVERY_URL = 'mini_result_recovery_url';
const RECOVERY_STARTED = 'mini_result_recovery_started';
const RECOVERY_ATTEMPTS = 'mini_result_recovery_attempts';
const now = Date.now();
const path = window.location.pathname;
const params = new URLSearchParams(window.location.search);

const clearRecovery = () => {
  sessionStorage.removeItem(RECOVERY_URL);
  sessionStorage.removeItem(RECOVERY_STARTED);
  sessionStorage.removeItem(RECOVERY_ATTEMPTS);
};

// Preserve the Asaas return URL while webhook/payment status propagation settles.
if (path.includes('/resultado') && params.get('session_id')) {
  sessionStorage.setItem(RECOVERY_URL, window.location.href);
  if (!sessionStorage.getItem(RECOVERY_STARTED)) {
    sessionStorage.setItem(RECOVERY_STARTED, String(now));
    sessionStorage.setItem(RECOVERY_ATTEMPTS, '0');
  }

  const observer = new MutationObserver(() => {
    if (document.querySelector('.report-card')) {
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

if (path === '/') {
  // The public link always starts a new diagnosis.
  // Recovery is only allowed on explicit /resultado URLs returned by Asaas.
  clearRecovery();
}
