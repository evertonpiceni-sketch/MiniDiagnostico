import { createHmac, timingSafeEqual } from 'node:crypto';
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import { RESULT_CONTENT, type ResultPattern } from '../src/result-content.ts';

type Req = { method?: string; query: Record<string, string | string[] | undefined> };
type Res = { status: (code: number) => Res; setHeader: (name: string, value: string) => void; end: (body?: any) => void; json: (data: unknown) => void };
const clean = (value?: string) => (value || '').trim().replace(/^["'](.*)["']$/, '$1').trim();
const DB_URL = clean(process.env.SUPABASE_URL).replace(/\/$/, '');
const DB_KEY = [process.env.SUPABASE_SERVICE_ROLE_KEY, process.env.SUPABASE_SECRET_KEY].map(clean).find(key => Boolean(key) && !key.startsWith('sb_publishable_')) || '';
const SECRET = clean(process.env.RESULT_TOKEN_SECRET);
const validId = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
function validToken(id: string, token: string) { if (SECRET.length < 32 || !token) return false; const expected = Buffer.from(createHmac('sha256', SECRET).update(`result:${id}`).digest('base64url')); const supplied = Buffer.from(token); return expected.length === supplied.length && timingSafeEqual(expected, supplied); }
async function db(resource: string) { if (!DB_URL || !DB_KEY) throw new Error('DB_CONFIG'); const response = await fetch(`${DB_URL}/rest/v1/${resource}`, { headers: { apikey: DB_KEY, ...(DB_KEY.startsWith('eyJ') ? { Authorization: `Bearer ${DB_KEY}` } : {}) } }); if (!response.ok) throw new Error(`DB_${response.status}`); return response.json(); }

const A4: [number, number] = [595.28, 841.89];
const paper = rgb(0.992, 0.975, 0.925);
const ink = rgb(0.18, 0.16, 0.14);
const palettes: Record<ResultPattern, { accent: ReturnType<typeof rgb>; soft: ReturnType<typeof rgb> }> = {
  MEDO: { accent: rgb(0.48, 0.29, 0.09), soft: rgb(0.95, 0.89, 0.79) },
  INSEGURANÇA: { accent: rgb(0.42, 0.17, 0.47), soft: rgb(0.94, 0.88, 0.96) },
  PROCRASTINAÇÃO: { accent: rgb(0.03, 0.37, 0.35), soft: rgb(0.89, 0.95, 0.94) },
};
const pdfText = (value: string) => value.replace(/→/g, '>').replace(/✓/g, '-').replace(/◇/g, '');
function lines(text: string, font: PDFFont, size: number, width: number) {
  const result: string[] = [];
  for (const paragraph of pdfText(text).split('\n')) {
    let line = '';
    for (const word of paragraph.split(/\s+/)) {
      const candidate = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) > width && line) { result.push(line); line = word; } else line = candidate;
    }
    if (line) result.push(line);
  }
  return result;
}
async function makePdf(result: any) {
  const pattern = (Object.prototype.hasOwnProperty.call(RESULT_CONTENT, result.resultado_dominante) ? result.resultado_dominante : 'MEDO') as ResultPattern;
  const content = RESULT_CONTENT[pattern]; const palette = palettes[pattern]; const document = await PDFDocument.create();
  const regular = await document.embedFont(StandardFonts.Helvetica); const bold = await document.embedFont(StandardFonts.HelveticaBold); const italic = await document.embedFont(StandardFonts.HelveticaOblique);
  let page!: PDFPage; let y = 0; const margin = 46; const usable = A4[0] - margin * 2;
  const addPage = (continuation = false) => { page = document.addPage(A4); page.drawRectangle({ x:0,y:0,width:A4[0],height:A4[1],color:paper }); page.drawRectangle({ x:0,y:A4[1]-12,width:A4[0],height:12,color:palette.accent }); page.drawText('Janaina Araujo',{x:margin,y:A4[1]-42,font:bold,size:14,color:palette.accent}); page.drawText(continuation ? `MINI DIAGNOSTICO - ${pdfText(pattern)}` : 'MINI DIAGNOSTICO - SUAS RESPOSTAS, SEU MAPA INTERIOR',{x:margin,y:A4[1]-57,font:regular,size:7.5,color:ink}); y=A4[1]-82; };
  const ensure=(height:number)=>{if(y-height<48)addPage(true)};
  const drawWrapped=(text:string, options:{font?:PDFFont;size?:number;color?:ReturnType<typeof rgb>;x?:number;width?:number;gap?:number}={})=>{const font=options.font||regular,size=options.size||10,x=options.x??margin,width=options.width??usable,gap=options.gap??size*1.38,wrapped=lines(text,font,size,width);ensure(wrapped.length*gap);for(const line of wrapped){page.drawText(line,{x,y,font,size,color:options.color||ink});y-=gap;}};
  const section=(title:string,paragraphs:string[],items:string[]=[],fill=rgb(1,1,1))=>{const paragraphLines=paragraphs.flatMap(t=>lines(t,regular,9.3,usable-28)),itemLines=items.flatMap(t=>lines(`- ${t}`,regular,9.3,usable-34)),height=39+(paragraphLines.length+itemLines.length)*13+Math.max(0,paragraphs.length-1)*6;ensure(height+12);const top=y;page.drawRectangle({x:margin,y:top-height,width:usable,height,color:fill,borderColor:palette.soft,borderWidth:1});y-=22;page.drawText(pdfText(title),{x:margin+14,y,font:bold,size:10,color:palette.accent});y-=19;paragraphs.forEach((t,i)=>{drawWrapped(t,{x:margin+14,width:usable-28,size:9.3,gap:13});if(i<paragraphs.length-1)y-=6});items.forEach(t=>drawWrapped(`- ${t}`,{x:margin+18,width:usable-34,size:9.3,gap:13}));y=top-height-12;};
  addPage(); const date=new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo'}).format(result.paid_at?new Date(result.paid_at):new Date());
  drawWrapped(`Ola, ${String(result.nome||'Cliente')}!`,{font:bold,size:15,color:palette.accent,gap:19}); drawWrapped(`Seu resultado - ${date}`,{size:8,color:rgb(.4,.38,.35),gap:17}); y-=4;
  const heroLines=lines(content.intro,italic,10.5,usable-32),heroHeight=73+heroLines.length*15; page.drawRectangle({x:margin,y:y-heroHeight,width:usable,height:heroHeight,color:palette.soft}); y-=22; page.drawText('SEU PADRAO PREDOMINANTE E:',{x:margin+16,y,font:bold,size:8,color:palette.accent}); y-=28; page.drawText(pdfText(pattern),{x:margin+16,y,font:bold,size:pattern==='PROCRASTINAÇÃO'?21:25,color:palette.accent}); y-=24; drawWrapped(content.intro,{x:margin+16,width:usable-32,font:italic,size:10.5,gap:15}); y-=14;
  section('INTERPRETACAO DO SEU RESULTADO',content.interpretation); if(content.cycle)section('O CICLO DO ADIAMENTO',[content.cycle],[],palette.soft); section('SINAIS COMUNS',[],content.signs); section('O QUE ISSO PODE CAUSAR',[],content.effects); section('UMA PERGUNTA IMPORTANTE',[`"${content.question}"`,content.questionNote],[],palette.soft); section('SEU CAMINHO DE TRANSFORMACAO',content.path,[],rgb(.93,.96,.91)); section('PRATICAS SUGERIDAS',[],content.practices,palette.soft);
  ensure(88);page.drawRectangle({x:margin,y:y-70,width:usable,height:70,color:palette.accent});y-=24;drawWrapped(`"${content.quote}"`,{x:margin+22,width:usable-44,font:italic,size:12,color:rgb(1,1,1),gap:16});
  const pages=document.getPages();pages.forEach((p,index)=>{p.drawLine({start:{x:margin,y:34},end:{x:A4[0]-margin,y:34},thickness:.7,color:palette.soft});p.drawText('AUTOCONHECIMENTO - EQUILIBRIO - TRANSFORMACAO',{x:margin,y:20,font:regular,size:6.8,color:palette.accent});p.drawText(`${index+1}/${pages.length}`,{x:A4[0]-margin-20,y:20,font:regular,size:7,color:palette.accent});}); return Buffer.from(await document.save());
}
export default async function handler(req:Req,res:Res){if(req.method!=='GET')return res.status(405).json({error:'Metodo nao permitido.'});try{const id=String(req.query.id||''),token=String(req.query.token||'');if(!validId(id))return res.status(400).json({error:'Sessao invalida.'});if(!validToken(id,token))return res.status(403).json({error:'Acesso ao PDF nao autorizado.'});const rows:any=await db(`quiz_sessions?quiz_session_id=eq.${encodeURIComponent(id)}&select=quiz_session_id,nome,score_medo,score_inseguranca,score_procrastinacao,resultado_dominante,payment_status,paid_at`);const result=rows?.[0];if(!result)return res.status(404).json({error:'Diagnostico nao encontrado.'});if(result.payment_status!=='paid')return res.status(402).json({error:'Pagamento ainda nao confirmado.'});const output=await makePdf(result);res.status(200);res.setHeader('Content-Type','application/pdf');res.setHeader('Content-Disposition',`attachment; filename="mini-diagnostico-${id.slice(0,8)}.pdf"`);res.setHeader('Cache-Control','private, no-store');return res.end(output);}catch(error){console.error('PDF diagnosis error',error);return res.status(500).json({error:'Nao foi possivel gerar o diagnostico em PDF.'});}}