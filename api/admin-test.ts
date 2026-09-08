import { createHmac, timingSafeEqual } from 'node:crypto';

type Req = { method?: string; headers: Record<string, string | string[] | undefined>; body?: any };
type Res = { status: (code:number)=>Res; json:(data:unknown)=>void; setHeader:(name:string,value:string)=>void };
const clean=(v?:string)=>(v||'').trim().replace(/^["'](.*)["']$/,'$1').trim();
const DB_URL=clean(process.env.SUPABASE_URL).replace(/\/$/,'');
const DB_KEY=[process.env.SUPABASE_SERVICE_ROLE_KEY,process.env.SUPABASE_SECRET_KEY].map(clean).find(k=>Boolean(k)&&!k.startsWith('sb_publishable_'))||'';
const RESULT_SECRET=clean(process.env.RESULT_TOKEN_SECRET);
const ADMIN_SECRET=clean(process.env.ADMIN_TEST_SECRET);
const validId=(id:string)=>/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
function safeEqual(a:string,b:string){const x=Buffer.from(a),y=Buffer.from(b);return x.length===y.length&&timingSafeEqual(x,y)}
function resultToken(id:string){return createHmac('sha256',RESULT_SECRET).update(`result:${id}`).digest('base64url')}
export default async function handler(req:Req,res:Res){
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='POST')return res.status(405).json({error:'Método não permitido.'});
  if(!DB_URL||!DB_KEY||RESULT_SECRET.length<32||ADMIN_SECRET.length<16)return res.status(503).json({error:'Modo ADM não configurado.'});
  const supplied=clean(String(req.headers['x-admin-test-secret']||req.body?.secret||''));
  if(!supplied||!safeEqual(supplied,ADMIN_SECRET))return res.status(401).json({error:'Acesso ADM inválido.'});
  const id=String(req.body?.quiz_session_id||'');
  if(!validId(id))return res.status(400).json({error:'Sessão inválida.'});
  const headers:any={apikey:DB_KEY,'Content-Type':'application/json',Prefer:'return=representation'};
  if(DB_KEY.startsWith('eyJ'))headers.Authorization=`Bearer ${DB_KEY}`;
  const r=await fetch(`${DB_URL}/rest/v1/quiz_sessions?quiz_session_id=eq.${encodeURIComponent(id)}`,{method:'PATCH',headers,body:JSON.stringify({payment_status:'paid',paid_at:new Date().toISOString()})});
  if(!r.ok){console.error('Admin test DB error',r.status,await r.text());return res.status(500).json({error:'Não foi possível liberar a sessão de teste.'})}
  return res.status(200).json({ok:true,payment_status:'paid',token:resultToken(id),test_mode:true});
}
