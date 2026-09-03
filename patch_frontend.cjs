const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const oldFetchResult = `  const fetchResult = async (sessionId: string | null) => {
    try {
      await new Promise(r => setTimeout(r, 2000));
      let backendPaid = false;
      if (sessionId) {
        const res = await fetch(\`/api/quiz/\${sessionId}\`);
        if (res.ok) {
          const data = await res.json();
          if (data.payment_status === 'paid') {
            setResultado(data);
            setCurrentStep('resultado');
            backendPaid = true;
            return;
          }
        }
      }
      if (!backendPaid) {
        if (window.location.pathname.includes('/resultado')) {
           toast.error('Pagamento não identificado. Conclua o pagamento para ver seu resultado.');
           setTimeout(() => { window.location.href = '/'; }, 2000);
        }
        setCurrentStep('paywall');
      }
    } catch (e) {
      toast.error('Não foi possível verificar seu pagamento no momento.');
      setCurrentStep('paywall');
    }
  };`;

const newFetchResult = `  const fetchResult = async (sessionId: string | null) => {
    try {
      if (sessionId) {
        try {
          await fetch(\`/api/quiz/\${sessionId}/verify-payment\`, { method: 'POST' });
        } catch(e){}
      }
      await new Promise(r => setTimeout(r, 1000));
      let backendPaid = false;
      if (sessionId) {
        const res = await fetch(\`/api/quiz/\${sessionId}\`);
        if (res.ok) {
          const data = await res.json();
          if (data.payment_status === 'paid') {
            setResultado(data);
            setCurrentStep('resultado');
            backendPaid = true;
            return;
          }
        }
      }
      if (!backendPaid) {
        if (window.location.pathname.includes('/resultado')) {
           toast.error('Pagamento não identificado. Conclua o pagamento para ver seu resultado.');
           setTimeout(() => { window.location.href = '/'; }, 2000);
        }
        setCurrentStep('paywall');
      }
    } catch (e) {
      toast.error('Não foi possível verificar seu pagamento no momento.');
      setCurrentStep('paywall');
    }
  };`;

if (code.includes(oldFetchResult)) {
  code = code.replace(oldFetchResult, newFetchResult);
  fs.writeFileSync('src/App.tsx', code);
  console.log('App.tsx patched successfully');
} else {
  console.log('Failed to match old fetchResult in App.tsx');
}
