import Stripe from 'stripe';

type Req = { method?: string; query: Record<string, string | string[] | undefined> };
type Res = { status: (code: number) => Res; setHeader: (name: string, value: string) => void; end: (body?: any) => void; json: (data: unknown) => void };

const clean = (v?: string) => (v || '').trim().replace(/^["'](.*)["']$/, '$1').trim();
const DB_URL = clean(process.env.SUPABASE_URL).replace(/\/$/, '');
const DB_KEY = clean(process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY);
const STRIPE_KEY = clean(process.env.STRIPE_SECRET_KEY);
const validId = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);

async function db<T>(resource: string): Promise<T> {
  if (!DB_URL || !DB_KEY) throw new Error('DB_CONFIG');
  const r = await fetch(`${DB_URL}/rest/v1/${resource}`, { headers: { apikey: DB_KEY, ...(DB_KEY.startsWith('eyJ') ? { Authorization: `Bearer ${DB_KEY}` } : {}), Accept: 'application/json' } });
  if (!r.ok) throw new Error(`DB_${r.status}`);
  return await r.json() as T;
}

function pdfText(value: unknown) {
  return String(value ?? '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^\x20-\x7E]/g, '').replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function makePdf(lines: string[]) {
  const safeLines = lines.map(pdfText);
  const stream = ['BT', '/F1 20 Tf', '50 760 Td', `(${safeLines[0]}) Tj`, '/F1 11 Tf', ...safeLines.slice(1).flatMap(line => ['0 -24 Td', `(${line}) Tj`]), 'ET'].join('\n');
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${Buffer.byteLength(stream, 'latin1')} >>\nstream\n${stream}\nendstream`,
  ];
  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [0];
  objects.forEach((object, index) => { offsets[index + 1] = Buffer.byteLength(pdf, 'latin1'); pdf += `${index + 1} 0 obj\n${object}\nendobj\n`; });
  const xref = Buffer.byteLength(pdf, 'latin1');
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= objects.length; i++) pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(pdf, 'latin1');
}

function summary(dominant: string) {
  if (dominant === 'INSEGURANÇA') return 'Seu resultado indica maior peso do padrao de inseguranca: observe como duvidas e autocobranca podem influenciar suas decisoes.';
  if (dominant === 'PROCRASTINAÇÃO') return 'Seu resultado indica maior peso do padrao de procrastinacao: observe como a urgencia pode estar sendo usada como gatilho para agir.';
  return 'Seu resultado indica maior peso do padrao de medo: observe como receios e antecipacao de consequencias podem influenciar suas decisoes.';
}

export default async function handler(req: Req, res: Res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Método não permitido.' });
  try {
    let id = String(req.query.id || '');
    const stripeSessionId = String(req.query.session_id || '');
    if (!validId(id) && stripeSessionId && STRIPE_KEY) {
      const stripe = new Stripe(STRIPE_KEY);
      const session = await stripe.checkout.sessions.retrieve(stripeSessionId);
      if (session.payment_status !== 'paid') return res.status(402).json({ error: 'Pagamento ainda não confirmado.' });
      const linked = session.metadata?.quiz_session_id || session.client_reference_id || '';
      if (!validId(linked)) return res.status(400).json({ error: 'Sessão do diagnóstico inválida.' });
      id = linked;
    }
    if (!validId(id)) return res.status(400).json({ error: 'Sessão inválida.' });
    const rows = await db<any[]>(`quiz_sessions?quiz_session_id=eq.${encodeURIComponent(id)}&select=quiz_session_id,nome,score_medo,score_inseguranca,score_procrastinacao,resultado_dominante,payment_status,paid_at`);
    const q = rows[0];
    if (!q) return res.status(404).json({ error: 'Diagnóstico não encontrado.' });
    if (q.payment_status !== 'paid') {
      if (!stripeSessionId || !STRIPE_KEY) return res.status(402).json({ error: 'Pagamento ainda não confirmado.' });
      const stripe = new Stripe(STRIPE_KEY);
      const session = await stripe.checkout.sessions.retrieve(stripeSessionId);
      const linked = session.metadata?.quiz_session_id || session.client_reference_id;
      if (session.payment_status !== 'paid' || linked !== id) return res.status(402).json({ error: 'Pagamento ainda não confirmado.' });
    }
    const nome = String(q.nome || 'Cliente');
    const dominant = String(q.resultado_dominante || 'MEDO');
    const pdf = makePdf([
      'MINI DIAGNOSTICO - RESULTADO COMPLETO',
      `Nome: ${nome}`,
      '',
      `Padrao dominante: ${dominant}`,
      `Medo: ${q.score_medo}/12`,
      `Inseguranca: ${q.score_inseguranca}/12`,
      `Procrastinacao: ${q.score_procrastinacao}/12`,
      '',
      summary(dominant),
      '',
      'Pagamento confirmado.',
      `Data de confirmacao: ${q.paid_at || 'registrada no sistema'}`,
      '',
      'Este documento e um material de autoconhecimento e nao substitui avaliacao profissional.',
    ]);
    const filename = `mini-diagnostico-${id.slice(0, 8)}.pdf`;
    res.status(200);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Cache-Control', 'private, no-store');
    res.end(pdf);
  } catch (e: any) {
    console.error('PDF diagnosis error', e?.message || e);
    return res.status(500).json({ error: 'Não foi possível gerar o diagnóstico em PDF.' });
  }
}
