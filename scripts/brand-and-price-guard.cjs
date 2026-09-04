const fs = require('fs');

const appPath = 'src/App.tsx';
let code = fs.readFileSync(appPath, 'utf8');

// Approved brand language: avoid therapeutic/cure promises.
code = code.replace(/cura/gi, 'caminho de volta pra si');

// Keep the displayed price explicit wherever it is rendered in the app.
code = code.replace(/R\$\s*47(?:[,.]00)?/g, 'R$ 9,90');

fs.writeFileSync(appPath, code);
console.log('Brand and price guard applied: R$ 9,90 / O caminho de volta pra si');
