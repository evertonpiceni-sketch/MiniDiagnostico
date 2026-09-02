require('dotenv').config();
const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
console.log("URL Configurada:", url ? url : "NÃO CONFIGURADA");
console.log("URL formato válido?", url && url.startsWith('https://') && url.includes('supabase.co'));
console.log("Key Configurada:", key ? "SIM (tamanho: " + key.length + ")" : "NÃO CONFIGURADA");
