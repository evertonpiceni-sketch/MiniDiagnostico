const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

code = code.replace(
  "const supabaseUrl = requiredEnv('SUPABASE_URL').replace(/\\/\\/$/, '');",
  "let supabaseUrl = requiredEnv('SUPABASE_URL').replace(/\\/\\/$/, '');\nif (supabaseUrl && !supabaseUrl.startsWith('http')) {\n  console.warn('WARNING: SUPABASE_URL does not start with http:// or https://. This will cause fetch errors.');\n  if (!supabaseUrl.includes('://')) {\n    supabaseUrl = 'https://' + supabaseUrl;\n  }\n}"
);

// wait the regex for replace is wrong. Let's just do a string replacement.
