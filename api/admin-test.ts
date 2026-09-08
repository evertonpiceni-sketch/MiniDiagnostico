import { createHmac, timingSafeEqual } from 'node:crypto';

type Req={method?:string;headers:Record<string,string|string[]|undefined>;body?:any};
type Res={status:(n:number)=>Res;json:(d:unknown)=>void;setHeader:(n:string,v:string)=>void};
const clean=(v?:string)=>(v||'').trim().replace(/^["'](.*)["']$/,'$1').trim();
const RESULT_SECRET=clean(process.env.RESULT_TOKEN_SECRET);
function eq(a:string,b:string){const x=Buffer.from(a),y=Buffer.from(b);return x.length===y.length&&timingSafeEqual(x,y)}
function verifyAdmin(raw:string){const [payload,sig]=raw.split('.');if(!payload||!sig||RESULT_SECRET.length<32)return null;const expected=createHmac('sha256',RESULT_SECRET).update(`admin:${payload}`).digest('base64url');if(!eq(sig,expected))return null;try{const d=JSON.parse(Buffer.from(payload,'base64url').toString('utf8'));if(d.exp<Date.now()||d.role!=='test'||d.user!=='janainateste')return null;return d}catch{return null}}
function resultToken(id:string){return createHmac('sha256',RESULT_SECRET).update(`result:${id}`).digest('base64url')}
export default async function handler(req:Req,res:Res){res.setHeader('Cache-Control','no-store');if(req.method!=='POST')return res.status(405).json({error:'Método não permitido.'});const auth=String(req.headers.authorization||'').replace(/^Bearer\s+/i,'');if(!verifyAdmin(auth))return res.status(401).json({error:'Acesso janainateste inválido ou expirado.'});const id=String(req.body?.quiz_session_id||'');if(!/^[0-9a-f-]{36}$/i.test(id))return res.status(400).json({error:'Sessão inválida.'});return res.status(200).json({ok:true,token:resultToken(id),test_mode:true,simulated_payment:true});}
