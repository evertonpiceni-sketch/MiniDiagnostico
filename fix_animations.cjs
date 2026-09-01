const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

// Replace AnimatePresence
code = code.replace(/<AnimatePresence mode="wait">/g, '<>');
code = code.replace(/<\/AnimatePresence>/g, '</>');

// Replace motion.div with div
code = code.replace(/<motion\.div[^>]*className=/g, (match) => {
    return match.replace('<motion.div', '<div').replace(/initial=\{[^}]*\}\s*/, '').replace(/animate=\{[^}]*\}\s*/, '').replace(/exit=\{[^}]*\}\s*/, '');
});
code = code.replace(/<\/motion\.div>/g, '</div>');

fs.writeFileSync('src/App.tsx', code);
console.log('Animations simplified');
