const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const anchor = `  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get('session_id');
    const isCanceled = params.get('canceled');
    if (window.location.pathname.includes('/resultado') || sessionId) {
      setCurrentStep('loading');
      fetchResult(sessionId);
    } else if (isCanceled) {
      setCurrentStep('paywall');
    }
  }, []);`;

const insert = `  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get('session_id');
    const isCanceled = params.get('canceled');
    if (window.location.pathname.includes('/resultado') || sessionId) {
      setCurrentStep('loading');
      fetchResult(sessionId);
    } else if (isCanceled) {
      setCurrentStep('paywall');
    }
  }, []);

  // Polling automático de pagamento para PIX (Stripe)
  useEffect(() => {
    let interval: any;
    if (currentStep === 'paywall' && quizSessionId) {
      interval = setInterval(async () => {
        try {
          const res = await fetch(\`/api/quiz/\${quizSessionId}/verify-payment\`, { method: 'POST' });
          if (res.ok) {
            const data = await res.json();
            if (data.payment_status === 'paid') {
              clearInterval(interval);
              setCurrentStep('loading');
              fetchResult(quizSessionId);
            }
          }
        } catch (e) {}
      }, 5000);
    }
    return () => clearInterval(interval);
  }, [currentStep, quizSessionId]);`;

if (code.includes(anchor)) {
  code = code.replace(anchor, insert);
  fs.writeFileSync('src/App.tsx', code);
  console.log('App.tsx patched successfully');
} else {
  console.log('Failed to match anchor in App.tsx');
}
