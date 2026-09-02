const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

// Replace background
code = code.replace(
  'className="min-h-screen bg-stone-50 flex flex-col items-center justify-center p-4 text-stone-800 font-sans"',
  'className="min-h-screen bg-gradient-to-br from-teal-50 via-sky-50 to-emerald-50 flex flex-col items-center justify-center p-4 text-stone-800 font-sans"'
);

// Form submit buttons
code = code.replace(
  'className="w-full bg-teal-700 text-white font-medium py-3 rounded-lg hover:bg-teal-800 transition-colors mt-4 shadow-sm shadow-stone-200"',
  'className="w-full bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white font-medium py-3 rounded-lg transition-colors mt-4 shadow-md shadow-emerald-900/10 active:scale-[0.98]"'
);

// Pay buttons
code = code.replace(
  'className="w-full bg-teal-700 text-white font-medium py-3 rounded-lg hover:bg-teal-800 transition-colors mt-4 flex justify-center items-center shadow-sm shadow-stone-200"',
  'className="w-full bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white font-medium py-3 rounded-lg transition-colors mt-4 flex justify-center items-center shadow-md shadow-emerald-900/10 active:scale-[0.98]"'
);

// Progress bar
code = code.replace(
  'className="bg-teal-700 h-full transition-all duration-300"',
  'className="bg-gradient-to-r from-teal-500 to-emerald-500 h-full transition-all duration-300"'
);

// Options hover
code = code.replace(
  'className="w-full text-left px-6 py-4 rounded-xl border border-stone-200 hover:border-teal-700 hover:bg-stone-50 transition-colors text-stone-700 font-medium"',
  'className="w-full text-left px-6 py-4 rounded-xl border border-stone-200 hover:border-emerald-500 hover:bg-emerald-50/50 hover:shadow-sm transition-all text-stone-700 font-medium"'
);

fs.writeFileSync('src/App.tsx', code);
