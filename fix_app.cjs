const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

// 1. Remove declare global block
code = code.replace(/declare global\s*\{[\s\S]*?\}\s*\}\s*\}/, '');

// 2. Add StripeBuyButton definition after imports
code = code.replace(/import toast, \{ Toaster \} from 'react-hot-toast';/, 
  `import toast, { Toaster } from 'react-hot-toast';\n\nconst StripeBuyButton = 'stripe-buy-button' as any;`);

// 3. Replace component tags
code = code.replace(/<stripe-buy-button/g, '<StripeBuyButton');
code = code.replace(/<\/stripe-buy-button>/g, '</StripeBuyButton>');

// 4. Color replacements
const replacements = {
  'bg-neutral-50': 'bg-stone-50',
  'text-neutral-900': 'text-stone-800',
  'text-neutral-800': 'text-stone-700',
  'text-neutral-700': 'text-stone-700',
  'text-neutral-600': 'text-stone-600',
  'text-neutral-500': 'text-stone-500',
  'text-neutral-400': 'text-stone-400',
  'border-neutral-100': 'border-stone-200',
  'border-neutral-200': 'border-stone-200',
  'bg-neutral-900': 'bg-teal-700',
  'bg-neutral-100': 'bg-stone-100',
  'bg-neutral-800': 'bg-teal-800',
  'hover:bg-neutral-800': 'hover:bg-teal-800',
  'hover:border-neutral-900': 'hover:border-teal-700',
  'hover:bg-neutral-50': 'hover:bg-stone-100',
  'hover:text-neutral-600': 'hover:text-stone-600',
  'shadow-neutral-200': 'shadow-stone-200',
  'shadow-neutral-100': 'shadow-stone-100',
  'prose-neutral': 'prose-stone'
};

for (const [key, value] of Object.entries(replacements)) {
  code = code.split(key).join(value);
}

fs.writeFileSync('src/App.tsx', code);
console.log('App.tsx fixed');
