const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

// Change main wrapper background
code = code.replace(
  "className=\"min-h-screen bg-stone-50 flex items-center justify-center p-4 md:p-8\"",
  "className=\"min-h-screen bg-gradient-to-br from-teal-50 via-emerald-50 to-stone-100 flex items-center justify-center p-4 md:p-8\""
);

// Progress bar colors
code = code.replace(
  "className=\"h-full bg-teal-600 transition-all duration-500 ease-out\"",
  "className=\"h-full bg-gradient-to-r from-teal-500 to-emerald-500 transition-all duration-500 ease-out\""
);

// Question card hover states
code = code.replace(
  "className=\"w-full text-left p-4 md:p-5 rounded-xl border border-stone-200 hover:border-teal-600 hover:bg-teal-50 transition-all text-stone-700 font-medium active:scale-[0.98]\"",
  "className=\"w-full text-left p-4 md:p-5 rounded-xl border border-stone-200 hover:border-emerald-500 hover:bg-white hover:shadow-md transition-all text-stone-700 font-medium active:scale-[0.98]\""
);

code = code.replace(
  "className=\"w-full text-left p-4 md:p-5 rounded-xl border-2 border-teal-600 bg-teal-50 transition-all text-teal-900 font-bold active:scale-[0.98]\"",
  "className=\"w-full text-left p-4 md:p-5 rounded-xl border-2 border-emerald-500 bg-emerald-50/50 shadow-sm transition-all text-emerald-900 font-bold active:scale-[0.98]\""
);

// Buttons
code = code.replace(
  /bg-teal-700 hover:bg-teal-800/g,
  "bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 shadow-md hover:shadow-lg"
);

// Paywall card
code = code.replace(
  "bg-stone-50 p-6 rounded-xl border border-stone-200",
  "bg-white p-6 rounded-xl border border-emerald-100 shadow-sm"
);

// Resultado titles
code = code.replace(
  /text-teal-800/g,
  "text-emerald-800"
);

fs.writeFileSync('src/App.tsx', code);
console.log('Colors updated');
