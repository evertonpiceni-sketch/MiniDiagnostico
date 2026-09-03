const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const oldHtml = 'html: `<p>Olá, ${escapeHtml(String(quiz.nome || \'\'))}.</p><p>Seu diagnóstico completo já está disponível.</p>`,';

const newHtml = 'html: `\n' +
'                  <div style="font-family: sans-serif; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">\n' +
'                    <h2 style="color: #4f46e5;">Olá, ${escapeHtml(String(quiz.nome || \'\'))}!</h2>\n' +
'                    <p>Obrigado por completar o seu Mini Diagnóstico. Aqui estão os seus resultados preliminares:</p>\n' +
'                    <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">\n' +
'                      <p style="font-size: 18px;"><strong>Traço Dominante:</strong> <span style="color: #ea580c; font-weight: bold;">${escapeHtml(String(quiz.resultado_dominante))}</span></p>\n' +
'                      <ul style="list-style-type: none; padding: 0;">\n' +
'                        <li style="margin-bottom: 8px;">📊 Nível de Medo: <strong>${quiz.score_medo}</strong>/12</li>\n' +
'                        <li style="margin-bottom: 8px;">📊 Nível de Insegurança: <strong>${quiz.score_inseguranca}</strong>/12</li>\n' +
'                        <li style="margin-bottom: 8px;">📊 Nível de Procrastinação: <strong>${quiz.score_procrastinacao}</strong>/12</li>\n' +
'                      </ul>\n' +
'                    </div>\n' +
'                    <p>Você pode acessar seu relatório completo através do link fornecido após o pagamento.</p>\n' +
'                    <p>Um abraço,<br/>Equipe do Mini Diagnóstico</p>\n' +
'                  </div>\n' +
'                `,';

if (code.includes(oldHtml)) {
  code = code.replace(oldHtml, newHtml);
  fs.writeFileSync('server.ts', code);
  console.log('Patch successful');
} else {
  console.log('Old HTML not found');
}
