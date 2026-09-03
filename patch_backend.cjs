const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const anchor = `app.get('/api/quiz/:id', rateLimit(30, 15 * 60 * 1000), async (req, res) => {`;

const insert = `app.post('/api/quiz/:id/verify-payment', rateLimit(10, 15 * 60 * 1000), async (req, res) => {
  try {
    const id = req.params.id;
    if (!/^[0-9a-f-]{36}$/i.test(id)) return res.status(400).json({ error: 'Sessão inválida.' });
    const quiz = await getQuiz(id);
    if (!quiz) return res.status(404).json({ error: 'Quiz não encontrado.' });
    
    let isPaid = quiz.payment_status === 'paid';
    
    // Fallback sync checking if not yet marked paid
    if (!isPaid && quiz.stripe_checkout_session_id) {
       const session = await stripe.checkout.sessions.retrieve(quiz.stripe_checkout_session_id);
       if (session.payment_status === 'paid') {
           await updateQuiz(id, { payment_status: 'paid', paid_at: new Date().toISOString() });
           isPaid = true;
           quiz.payment_status = 'paid';
       }
    }
    
    // Ensure email is sent if paid
    if (isPaid && !quiz.email_sent_at) {
       if (resend && quiz.email) {
          try {
              const link = \`\${appUrl}/resultado?session_id=\${encodeURIComponent(id)}\`;
              await resend.emails.send({
                from: process.env.RESEND_FROM_EMAIL || 'Mini Diagnóstico <onboarding@resend.dev>',
                to: quiz.email,
                subject: 'Seu Mini Diagnóstico está pronto!',
                html: \`
                  <div style="font-family: sans-serif; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <h2 style="color: #4f46e5;">Olá, \${escapeHtml(String(quiz.nome || ''))}!</h2>
                    <p>Obrigado por completar o seu Mini Diagnóstico. Aqui estão os seus resultados preliminares:</p>
                    <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
                      <p style="font-size: 18px;"><strong>Traço Dominante:</strong> <span style="color: #ea580c; font-weight: bold;">\${escapeHtml(String(quiz.resultado_dominante))}</span></p>
                      <ul style="list-style-type: none; padding: 0;">
                        <li style="margin-bottom: 8px;">📊 Nível de Medo: <strong>\${quiz.score_medo}</strong>/12</li>
                        <li style="margin-bottom: 8px;">📊 Nível de Insegurança: <strong>\${quiz.score_inseguranca}</strong>/12</li>
                        <li style="margin-bottom: 8px;">📊 Nível de Procrastinação: <strong>\${quiz.score_procrastinacao}</strong>/12</li>
                      </ul>
                    </div>
                    <p>Você pode acessar seu relatório completo através do link fornecido em nossa plataforma.</p>
                    <p>Um abraço,<br/>Equipe do Mini Diagnóstico</p>
                  </div>
                \`,
              });
              await updateQuiz(id, { email_sent_at: new Date().toISOString() });
          } catch (emailError) {
              console.error('Email delivery failed:', emailError);
          }
       }
    }
    
    return res.json({ payment_status: isPaid ? 'paid' : 'pending' });
  } catch (error: any) {
    console.error('Verify payment error:', error?.message || error);
    return res.status(500).json({ error: 'Erro ao verificar pagamento.' });
  }
});\n\n`;

if (code.includes(anchor)) {
  code = code.replace(anchor, insert + anchor);
  fs.writeFileSync('server.ts', code);
  console.log('server.ts patched successfully');
} else {
  console.log('Failed to match anchor in server.ts');
}
