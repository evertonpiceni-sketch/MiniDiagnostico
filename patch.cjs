const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

code = code.replace(
  "const supabaseUrl = requiredEnv('SUPABASE_URL').replace(/\\/\\/$/, '');",
  "let supabaseUrl = requiredEnv('SUPABASE_URL').replace(/\\/\\/$/, '');\nif (supabaseUrl && !supabaseUrl.startsWith('http')) {\n  console.warn('WARNING: SUPABASE_URL does not start with http:// or https://. Adicionando automaticamente...');\n  if (!supabaseUrl.includes('supabase.co')) {\n    supabaseUrl = 'https://' + supabaseUrl + '.supabase.co';\n  } else {\n    supabaseUrl = 'https://' + supabaseUrl;\n  }\n}"
);

fs.writeFileSync('server.ts', code);
console.log("Patched server.ts");
