const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const oldFetchResult = `      if (!backendPaid && window.location.pathname.includes('/resultado')) {
         const localRes = localStorage.getItem('janaina_resultado');
         if (localRes) {
           setResultado(JSON.parse(localRes));
           setCurrentStep('resultado');
           return;
         }
      }
      setCurrentStep('paywall');
    } catch (e) {
      if (window.location.pathname.includes('/resultado')) {
         const localRes = localStorage.getItem('janaina_resultado');
         if (localRes) {
           setResultado(JSON.parse(localRes));
           setCurrentStep('resultado');
           return;
         }
      }
      toast.error('Não foi possível carregar seu resultado no momento.');
      setCurrentStep('paywall');
    }`;

const newFetchResult = `      if (!backendPaid) {
        if (window.location.pathname.includes('/resultado')) {
           toast.error('Pagamento não identificado. Conclua o pagamento para ver seu resultado.');
           setTimeout(() => { window.location.href = '/'; }, 2000);
        }
        setCurrentStep('paywall');
      }
    } catch (e) {
      toast.error('Não foi possível verificar seu pagamento no momento.');
      setCurrentStep('paywall');
    }`;

code = code.replace(oldFetchResult, newFetchResult);
fs.writeFileSync('src/App.tsx', code);
console.log('Fixed paywall bypass.');
