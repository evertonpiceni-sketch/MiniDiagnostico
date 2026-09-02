const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

// Update dbRequest to have strict URL validation
const oldDbRequestCheck = `  if (!supabaseUrl || !supabaseUrl.startsWith('https://') || supabaseUrl.includes('run.app') || supabaseUrl.includes('google.com')) {
    throw new Error('A variável SUPABASE_URL não está configurada corretamente. Adicione a URL do seu projeto Supabase (ex: https://xyz.supabase.co) nas configurações do AI Studio.');
  }`;

const newDbRequestCheck = `  if (!supabaseUrl || !supabaseUrl.startsWith('https://') || supabaseUrl.includes('run.app') || supabaseUrl.includes('google.com') || !supabaseUrl.includes('supabase.co')) {
    throw new Error('SUPABASE_URL_INVALID: A variável SUPABASE_URL não parece ser uma URL válida do Supabase. Verifique se você não colou acidentalmente a URL do próprio aplicativo. O formato correto é algo como https://xyz.supabase.co e deve ser configurado no painel do AI Studio (ícone de engrenagem).');
  }`;

code = code.replace(oldDbRequestCheck, newDbRequestCheck);

// Update error throwing for 404
const oldThrow404 = `    const body = await response.text();
    throw new Error(\`Database request failed (\${response.status}): \${body.slice(0, 500)}\`);`;

const newThrow404 = `    const body = await response.text();
    if (response.status === 404 || body.includes('<!DOCTYPE html>')) {
        throw new Error('SUPABASE_URL_INVALID: O banco de dados retornou 404 (Página Não Encontrada). Isso indica que a variável SUPABASE_URL preenchida no painel de configurações (Secrets) está incorreta ou aponta para uma página web, em vez de apontar para a API do Supabase.');
    }
    throw new Error(\`Database request failed (\${response.status}): \${body.slice(0, 500)}\`);`;

code = code.replace(oldThrow404, newThrow404);

// Update catch block in app.post('/api/quiz'
const oldCatchQuiz = `  } catch (error: any) {
    console.error('Quiz creation error:', error?.message || error);
    if (error?.message?.includes('SUPABASE_URL')) { return res.status(500).json({ error: error.message }); }
    return res.status(400).json({ error: 'Dados do quiz inválidos.' });
  }`;

const newCatchQuiz = `  } catch (error: any) {
    console.error('Quiz creation error:', error?.message || error);
    if (error?.message?.includes('SUPABASE_URL_INVALID')) { 
      return res.status(500).json({ error: error.message.replace('SUPABASE_URL_INVALID: ', '') }); 
    }
    return res.status(400).json({ error: 'Dados do quiz inválidos.' });
  }`;

code = code.replace(oldCatchQuiz, newCatchQuiz);

fs.writeFileSync('server.ts', code);
console.log('Patched server.ts successfully.');
