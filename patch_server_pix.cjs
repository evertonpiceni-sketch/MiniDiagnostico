const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const anchor = `    // Fallback sync checking if not yet marked paid
    if (!isPaid && quiz.stripe_checkout_session_id) {
       const session = await stripe.checkout.sessions.retrieve(quiz.stripe_checkout_session_id);
       if (session.payment_status === 'paid') {
           await updateQuiz(id, { payment_status: 'paid', paid_at: new Date().toISOString() });
           isPaid = true;
           quiz.payment_status = 'paid';
       }
    }`;

const insert = `    // Fallback sync checking se não foi marcado como pago via webhook
    if (!isPaid) {
       let foundSession = null;
       if (quiz.stripe_checkout_session_id) {
           foundSession = await stripe.checkout.sessions.retrieve(quiz.stripe_checkout_session_id);
       } else {
           // Pricing table fallback: Stripe Pricing table não envia o session_id diretamente,
           // então buscamos as sessões recentes para achar a do cliente atual via client_reference_id
           const recentSessions = await stripe.checkout.sessions.list({ limit: 100 });
           foundSession = recentSessions.data.find(s => s.client_reference_id === id);
       }
       
       if (foundSession && foundSession.payment_status === 'paid') {
           await updateQuiz(id, { payment_status: 'paid', paid_at: new Date().toISOString(), stripe_checkout_session_id: foundSession.id });
           isPaid = true;
           quiz.payment_status = 'paid';
       }
    }`;

if (code.includes(anchor)) {
  code = code.replace(anchor, insert);
  fs.writeFileSync('server.ts', code);
  console.log('server.ts patched successfully');
} else {
  console.log('Failed to match anchor in server.ts');
}
