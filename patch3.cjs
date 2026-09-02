const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

code = code.replace(
  "throw new Error(\`Database request failed (\${response.status}): \${body.slice(0, 500)}\`);",
  "throw new Error(\`Database request failed (\${response.status}): \${body.slice(0, 500)}\`);"
);

// I want to catch the error thrown from fetch itself.
code = code.replace(
  "return response.json() as Promise<T>;\n}",
  "return response.json() as Promise<T>;\n} catch (e: any) {\n  if (e.message && e.message.includes('fetch failed')) { throw new Error('A variável SUPABASE_URL não aponta para um banco Supabase válido. Configure-a com a URL correta no menu Settings.'); }\n  throw e;\n}"
);

// Wait, dbRequest doesn't have a try-catch yet.
