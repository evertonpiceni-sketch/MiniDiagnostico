const fs = require('fs');
let code = fs.readFileSync('index.html', 'utf8');

code = code.replace('<script async src="https://js.stripe.com/v3/buy-button.js"></script>', '<script async src="https://js.stripe.com/v3/pricing-table.js"></script>');

fs.writeFileSync('index.html', code);
console.log('index.html patched successfully');
