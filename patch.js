const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

code = code.replace(
  "const supabaseUrl = requiredEnv('SUPABASE_URL').replace(/\\/$/, '');",
  \`let supabaseUrl = requiredEnv('SUPABASE_URL').replace(/\\/$/, '');
if (supabaseUrl && !supabaseUrl.startsWith('http')) {
  console.warn('WARNING: SUPABASE_URL does not start with http:// or https://. Adicionando https:// automaticamente...');
  // Se o usuário digitou apenas o nome do projeto (ex: Minidiagnóstico)
  if (!supabaseUrl.includes('supabase.co')) {
    supabaseUrl = 'https://' + supabaseUrl + '.supabase.co';
  } else {
    supabaseUrl = 'https://' + supabaseUrl;
  }
}\`
);

fs.writeFileSync('server.ts', code);
console.log("Patched server.ts");
