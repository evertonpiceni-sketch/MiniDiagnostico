require('dotenv').config();
async function run() {
  console.log("--- INICIANDO AUDITORIA FINAL ---");
  const url = process.env.SUPABASE_URL?.replace(/\/$/, '');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!url || !key) {
    console.log("❌ ERRO: Variáveis do Supabase ausentes no painel Secrets.");
    return;
  }
  
  console.log("1. Variáveis de ambiente configuradas corretamente.");
  console.log(`   URL conectada: ${url}`);
  
  try {
    const res = await fetch(`${url}/rest/v1/quiz_sessions?select=quiz_session_id&limit=1`, {
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`
      }
    });
    
    if (res.ok) {
       console.log("2. ✅ SUCESSO! Banco de dados conectado E a tabela 'quiz_sessions' existe.");
    } else {
       const text = await res.text();
       console.log(`2. ❌ ERRO no Banco: Status ${res.status}. Detalhes: ${text.substring(0, 150)}`);
    }
  } catch (e) {
    console.error("2. ❌ Falha na requisição de rede:", e.message);
  }
}
run();
