const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const oldCheck = `  if (!supabaseUrl || !supabaseUrl.startsWith('https://') || supabaseUrl.includes('run.app') || supabaseUrl.includes('google.com') || !supabaseUrl.includes('supabase.co')) {
    throw new Error('SUPABASE_URL_INVALID: A variável SUPABASE_URL não parece ser uma URL válida do Supabase. Verifique se você não colou acidentalmente a URL do próprio aplicativo. O formato correto é algo como https://xyz.supabase.co e deve ser configurado no painel do AI Studio (ícone de engrenagem).');
  }`;

const newCheck = `  if (!supabaseUrl || !supabaseUrl.startsWith('https://') || supabaseUrl.includes('run.app') || supabaseUrl.includes('google.com') || (!supabaseUrl.includes('supabase.co') && !supabaseUrl.includes('supabase.com'))) {
    throw new Error('SUPABASE_URL_INVALID: A variável SUPABASE_URL não parece ser uma URL válida do Supabase. O formato correto é algo como https://xyz.supabase.co.');
  }
  if (!supabaseServiceRoleKey || supabaseServiceRoleKey.length < 50) {
    throw new Error('SUPABASE_URL_INVALID: A chave SUPABASE_SERVICE_ROLE_KEY parece estar incorreta. Ela deve ser um token longo (geralmente começando com eyJ) e não uma senha curta. Vá em Project Settings -> API no Supabase e copie a chave service_role secret.');
  }`;

code = code.replace(oldCheck, newCheck);
fs.writeFileSync('server.ts', code);
console.log('Patched check');
