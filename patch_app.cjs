const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const anchor1 = `const StripeBuyButton = 'stripe-buy-button' as any;`;
const insert1 = `const StripeBuyButton = 'stripe-buy-button' as any;
const StripePricingTable = 'stripe-pricing-table' as any;`;
code = code.replace(anchor1, insert1);

const anchor2 = `          <div className="bg-white p-6 rounded-xl border border-emerald-100 shadow-sm mb-6 text-left shadow-sm">
            <p className="font-bold text-lg text-stone-800 mb-2">Diagnóstico Completo — R$ 9,90</p>
            <p className="text-sm text-stone-500 mb-4">Pague via Cartão de Crédito ou Apple/Google Pay (Até parcelado)</p>
            
            <button 
              onClick={handleCheckout} 
              disabled={isCheckoutLoading}
              className="w-full bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white font-medium py-3 rounded-lg transition-colors mt-4 flex justify-center items-center shadow-md shadow-emerald-900/10 active:scale-[0.98]"
            >
              {isCheckoutLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'PAGAR COM CARTÃO OU PIX (STRIPE)'}
            </button>
          </div>`;

const insert2 = `          <div className="mb-6 w-full max-w-md mx-auto">
            <StripePricingTable
              pricing-table-id="prctbl_1UBY83Di05Nlzxp3DgkBxMcV"
              publishable-key="pk_live_51U8Y2oDi05Nlzxp3UkGitm1KdK7v7pIZAsZKY61BkVjmArAtt7DDDjQsL3ogLG45jfA3BDah4CUniaQjPzq5At4X00uTTvUtF1"
              client-reference-id={quizSessionId}
            ></StripePricingTable>
          </div>`;
          
code = code.replace(anchor2, insert2);

fs.writeFileSync('src/App.tsx', code);
console.log('App.tsx patched successfully');
