const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

code = code.replace(
  "async function dbRequest<T>(pathName: string, init: RequestInit = {}): Promise<T> {",
  "async function dbRequest<T>(pathName: string, init: RequestInit = {}): Promise<T> {\n  if (!supabaseUrl || !supabaseUrl.startsWith('https://') || supabaseUrl.includes('run.app') || supabaseUrl.includes('google.com')) {\n    throw new Error('A variável SUPABASE_URL não está configurada corretamente. Adicione a URL do seu projeto Supabase (ex: https://xyz.supabase.co) nas configurações do AI Studio.');\n  }"
);

// also catch the error nicely and return the error string to the user
const oldCatch = "if (error?.message?.includes('parse URL')) { return res.status(500).json({ error: 'A configuração do banco de dados (SUPABASE_URL) está inválida nas configurações do AI Studio.' }); }";
const newCatch = "if (error?.message?.includes('SUPABASE_URL')) { return res.status(500).json({ error: error.message }); }";
code = code.replace(oldCatch, newCatch);

fs.writeFileSync('server.ts', code);
console.log('dbRequest patched.');
