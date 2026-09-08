import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

type Req={method?:string;body?:any};
type Res={status:(n:number)=>Res;json:(d:unknown)=>void;setHeader:(n:string,v:string)=>void};
const clean=(v?:string)=>(v||'').trim().replace(/^["'](.*)["']$/,'$1').trim();
const SESSION_MATERIAL=[process.env.ADMIN_SESSION_SECRET,process.env.RESULT_TOKEN_SECRET,process.env.ASAAS_WEBHOOK_TOKEN,process.env.SUPABASE_SERVICE_ROLE_KEY,process.env.SUPABASE_SECRET_KEY,process.env.ASAAS_API_KEY].map(clean).find(v=>v.length>=16)||'';
const SESSION_SECRET=SESSION_MATERIAL?createHash('sha256').update(`admin-session:${SESSION_MATERIAL}`).digest('hex'):'';
const USERS={janainabrandao:{password:clean(process.env.JANAINA_ADMIN_PASSWORD),role:'support'},janainateste:{password:clean(process.env.JANAINA_TEST_PASSWORD),role:'test'}} as const;
function eq(a:string,b:string){const x=Buffer.from(a),y=Buffer.from(b);return x.length===y.length&&timingSafeEqual(x,y)}
function token(user:string,role:string,exp:number){const payload=Buffer.from(JSON.stringify({user,role,exp})).toString('base64url');const sig=createHmac('sha256',SESSION_SECRET).update(`admin:${payload}`).digest('base64url');return `${payload}.${sig}`}
export default function handler(req:Req,res:Res){res.setHeader('Cache-Control','no-store');if(req.method!=='POST')return res.status(405).json({error:'Método não permitido.'});if(!SESSION_SECRET)return res.status(503).json({error:'Autenticação ADM não configurada.'});const username=clean(String(req.body?.username||'')).toLowerCase() as keyof typeof USERS;const account=USERS[username];const password=String(req.body?.password||'');if(!account||!account.password||account.password.length<8||!password||!eq(password,account.password))return res.status(401).json({error:'Usuário ou senha inválidos.'});const exp=Date.now()+4*60*60*1000;return res.status(200).json({ok:true,username,role:account.role,expires_at:new Date(exp).toISOString(),admin_token:token(username,account.role,exp)});}
