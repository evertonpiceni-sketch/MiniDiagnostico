const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

code = code.replace(
  "async function dbRequest<T>(pathName: string, init: RequestInit = {}): Promise<T> {",
  "async function dbRequest<T>(pathName: string, init: RequestInit = {}): Promise<T> {\n  try {"
);

code = code.replace(
  "  if (response.status === 204) return undefined as T;\n  return response.json() as Promise<T>;\n}",
  "  if (response.status === 204) return undefined as T;\n  return response.json() as Promise<T>;\n  } catch (err: any) {\n    if (err.message && err.message.includes('fetch failed')) { throw new Error('Falha de conexão com o Supabase. Verifique se a variável SUPABASE_URL está correta.'); }\n    throw err;\n  }\n}"
);

fs.writeFileSync('server.ts', code);
console.log("Patched server.ts dbRequest");
