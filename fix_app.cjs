const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

code = code.replace(
  "const [showPix, setShowPix] = useState(false);",
  `const [showPix, setShowPix] = useState(false);
  const [isCheckoutLoading, setIsCheckoutLoading] = useState(false);

  const handleCheckout = async () => {
    if (!quizSessionId) {
       toast.error("Sessão inválida. Tente novamente.");
       return;
    }
    setIsCheckoutLoading(true);
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quiz_session_id: quizSessionId })
      });
      const data = await res.json();
      if (res.ok && data.url) {
        window.location.href = data.url;
      } else {
        toast.error(data.error || 'Erro ao iniciar o pagamento.');
      }
    } catch (e) {
      toast.error('Erro de conexão ao iniciar o pagamento.');
    } finally {
      setIsCheckoutLoading(false);
    }
  };`
);

const buyButtonHtml = `<StripeBuyButton
              buy-button-id="buy_btn_1UAhRXDi05Nlzxp3LUM7iKKs"
              publishable-key="pk_live_51U8Y2oDi05Nlzxp3UkGitm1KdK7v7pIZAsZKY61BkVjmArAtt7DDDjQsL3ogLG45jfA3BDah4CUniaQjPzq5At4X00uTTvUtF1"
              client-reference-id={quizSessionId || undefined}
            >
            </StripeBuyButton>`;

const checkoutButtonHtml = `<button 
              onClick={handleCheckout} 
              disabled={isCheckoutLoading}
              className="w-full bg-teal-700 text-white font-medium py-3 rounded-lg hover:bg-teal-800 transition-colors mt-4 flex justify-center items-center shadow-sm shadow-stone-200"
            >
              {isCheckoutLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'PAGAR COM CARTÃO OU PIX (STRIPE)'}
            </button>`;

code = code.replace(buyButtonHtml, checkoutButtonHtml);

fs.writeFileSync('src/App.tsx', code);
console.log('App.tsx updated');
