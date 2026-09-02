const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

code = code.replace(
  "return res.status(400).json({ error: 'Dados do quiz inválidos.' });",
  "if (error?.message?.includes('parse URL')) { return res.status(500).json({ error: 'A configuração do banco de dados (SUPABASE_URL) está inválida nas configurações do AI Studio.' }); }\n    return res.status(400).json({ error: 'Dados do quiz inválidos.' });"
);

fs.writeFileSync('server.ts', code);
console.log("Patched server.ts error handling");
