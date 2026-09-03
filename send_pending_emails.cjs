require('dotenv').config();
const { Resend } = require('resend');

async function run() {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, '');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const resendKey = process.env.RESEND_API_KEY;
  
  if (!url || !key) {
    console.log("Variáveis Supabase ausentes.");
    return;
  }
  
  const resend = resendKey ? new Resend(resendKey) : null;
  if (!resend) {
    console.log("Variável RESEND_API_KEY ausente. Não é possível enviar e-mail.");
    return;
  }

  try {
    const res = await fetch(`${url}/rest/v1/quiz_sessions?select=*`, {
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`
      }
    });
    
    if (res.ok) {
       const sessions = await res.json();
       console.log(`Encontradas ${sessions.length} sessões no banco.`);
       
       for (const quiz of sessions) {
         if (!quiz.email) continue;
         
         console.log(`Enviando e-mail para ${quiz.email}...`);
         
         let link = `https://ais-pre-yiaudhhayxyr6mhcdkesfd-414083061229.us-west1.run.app/resultado?session_id=${quiz.quiz_session_id}`;
         
         const emailRes = await resend.emails.send({
            from: process.env.RESEND_FROM_EMAIL || 'Mini Diagnóstico <onboarding@resend.dev>',
            to: quiz.email,
            subject: 'Seu Mini Diagnóstico está pronto!',
            html: `<p>Olá, ${quiz.nome}.</p><p>Seu diagnóstico completo já está disponível.</p><p>Acesse seu resultado aqui: <a href="${link}">${link}</a></p>`,
          });
          console.log(`Email enviado! ID: ${emailRes.id || JSON.stringify(emailRes)}`);
       }
    } else {
       console.log("Erro ao buscar quizzes:", await res.text());
    }
  } catch (e) {
    console.error("Erro:", e.message);
  }
}
run();
