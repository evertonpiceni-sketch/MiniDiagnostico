require('dotenv').config();

async function run() {
  const supabaseUrl = process.env.SUPABASE_URL?.replace(/\/$/, '');
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    console.log("Variáveis ausentes.");
    return;
  }

  console.log("Testando URL:", supabaseUrl);
  try {
    const res = await fetch(`${supabaseUrl}/rest/v1/quiz_sessions?select=quiz_session_id&limit=1`, {
      headers: {
        apikey: supabaseServiceRoleKey,
        Authorization: `Bearer ${supabaseServiceRoleKey}`
      }
    });
    
    console.log("Status Code:", res.status);
    const text = await res.text();
    if (res.ok) {
       console.log("Sucesso! Banco conectado e tabela ENCONTRADA. Resposta:", text);
    } else {
       console.log("Erro na resposta:", text.substring(0, 150));
    }
  } catch (e) {
    console.error("Falha na requisição:", e.message);
  }
}
run();
