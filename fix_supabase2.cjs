const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const oldCheck = "if (!supabaseUrl || !supabaseUrl.startsWith('https://') || supabaseUrl.includes('run.app') || supabaseUrl.includes('google.com')) {\\n    throw new Error('A variável SUPABASE_URL não está configurada corretamente. Adicione a URL do seu projeto Supabase (ex: https://xyz.supabase.co) nas configurações do AI Studio.');\\n  }";

const newCheck = "if (!supabaseUrl || !supabaseUrl.startsWith('https://') || supabaseUrl.includes('run.app') || supabaseUrl.includes('google.com') || !supabaseUrl.includes('supabase.co')) {\\n    throw new Error('Erro de Configuração: A variável SUPABASE_URL não parece ser uma URL válida do Supabase. Verifique se você não colou acidentalmente a URL do próprio aplicativo. O formato correto é algo como https://xyz.supabase.co e deve ser configurado no painel do AI Studio.');\\n  }";

code = code.replace(oldCheck, newCheck);
fs.writeFileSync('server.ts', code);
console.log('dbRequest check refined.');
