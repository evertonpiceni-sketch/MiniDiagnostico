const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');
code = code.replace(
  '  if (response.status === 204) return undefined as T;\n  return response.json() as Promise<T>;',
  '  const text = await response.text();\n  if (!text) return undefined as T;\n  return JSON.parse(text) as T;'
);
fs.writeFileSync('server.ts', code);
console.log('Patched JSON parser');
