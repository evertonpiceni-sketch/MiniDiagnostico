import Stripe from 'stripe';

type Req = { method?: string; query: Record<string, string | string[] | undefined> };
type Res = { status: (code: number) => Res; setHeader: (name: string, value: string) => void; end: (body?: any) => void; json: (data: unknown) => void };

const clean = (v?: string) => (v || '').trim().replace(/^["'](.*)["']$/, '$1').trim();
const DB_URL = clean(process.env.SUPABASE_URL).replace(/\/$/, '');
const DB_KEY = [process.env.SUPABASE_SERVICE_ROLE_KEY, process.env.SUPABASE_SECRET_KEY).map(clean).find((key) => Boolean(key) && !key.startsWith('sb_publishable_')) || '';
const STRIPE_KEY = clean(process.env.STRIPE_SECRET_KEY);
const validId = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);

async function db<T>(resource: string, init: RequestInit = {}): Promise<T> {
  if (!DB_URL || !DB_KEY) throw new Error('DB_CONFIG');
  const r = await fetch(`${DB_URL}/rest/v1/${resource}`, {
    ...init,
    headers: { apikey: DB_KEY, ...(DB_KEY.startsWith('eyJ') ? { Authorization: `Bearer ${DB_KEY}` } : {}), Accept: 'application/json', ...(init.headers || {}) },
  });
  if (!r.ok) throw new Error(`DB_${r.status}`);
  const text = await r.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

function pdfText(value: unknown) {
  return String(value ?? '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^\x20-\x7E]/g, '').replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

// Compact copy of the supplied Janaína Araújo logo, used so the paid PDF is self-contained.
const LOGO_JPEG_BASE64 = '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDABIMDRANCxIQDhAUExIVGywdGxgYGzYnKSAsQDlEQz85Pj1HUGZXR0thTT0+WXlaYWltcnNyRVV9hnxvhWZwcm7/2wBDARMUFBsXGzQdHTRuST5Jbm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm7/wAARCACAAIADASIAAhEBAxEB/8QAGgABAQEBAQEBAAAAAAAAAAAAAQACBQMEBv/EADMQAAICAQEFBQYFBQAAAAAAAAABAgMRBBITITFBBSJRcYEUQlJhocEyM3KRsRUjJOHw/8QAFgEBAQEAAAAAAAAAAAAAAAAAAAIB/8QAHBEBAAICAwEAAAAAAAAAAAAAAAERAiESMVFB/9oADAMBAAIRAxEAPwD8QIIQISFAQkIAOCEAwBoADAGgAyBoAABBgKEBARQI0BCQoCISAANAAAaYAZA0ZYAAgBCAgaQoEKAUKA1CLnJRim5N4SXNgRHS3Gk7OS9tT1GoazuISxGP6n9gfbeqisaeNGmj0VVaX1J5X02q7c4j7n2xq58LnVevC2tMw1p9V+VH2e74G8wl5N8n5i/SnxsDUouMnGSaaeGn0MspgMs0DAyAgBCCEBRpGRQGjpaX/A0HtmE7rW4U591dZfY5meB0+2sQt01Mfw1UQXq1lk5bqFR65+W223lvi2z3p0s7IbyTjXW3hTl1fglzb8jwWMrPBdTrzzpoyvniNj7tKfKmHxL5vp+4ymiIt8Goor0+Yytk7VzhscvPiedGnnqJ7MFw6t8kfXKpXXpKK9neIwsS7z8OPVnpqYPS0blrYsmsNLnx91fd+hPL4cXybC1OohVCTm9pQ3mMbS6HjTS7puO1GGIuWZvHTJ2OwdVpKLGraFt8u9JvH/YPg7Vt01upnKiE4+HeTX8ZNid0TGrfCzLFsC0hgxZkCECA0KMoQNHU7VhK+WjurW1vqUvVcGco6vZ1vtOis0Lw7VmVO0+fjH1Iy1tWPjyoq09cHde3ZCPDhwUpeC8fmeU9ddZZOctjvrEljmvAxvJu3FmypR7qhJYjH5fI9NzqMcNMmujjHK/dCvsl+MVau6m1WVyUXFYSS4L0PJycm5SbbfVnu67ItOyNNeF7z+3MzKaWXB1S8Uk1/JumPOubhPaWeCf8GXsbtcXt54rHDHmetqdVfeWLLFlr4Y/7PnyaJgQGsQEQAIEBogIDQxk4yUotprimuhkcgdRajSdopLXSdGp5b+KzGX6l9wfYerfHTunUQ6SqsXH0eGcwk2uTa8mTUx0277dH+i6yPG6FdEesrLIpL6mHLS6P8qS1N65Sx/bj5J/if0Pibb5tvzYCp+ltTnKc3KbcpSeW31MkBTERABARARAIEIEAkAgJZAgEsgQERAAgRAQCAEREBERAJEQEREBERAREAEQgBGrK51TcLIuMlzTKucqrIzg8Si8pntrdZZrbt5bjlhJdAP/Z';

function makePdf(lines: string[]) {
  const safeLines = lines.map(pdfText);
  const image = Buffer.from(LOGO_JPEG_BASE64, 'base64');
  const content = [
    'q',
    '90 0 0 90 50 735 cm',
    '/Im1 Do',
    'Q',
    'BT',
    '/F1 18 Tf',
    '165 770 Td',
    '(JANAINA ARAUJO) Tj',
    '/F1 10 Tf',
    '0 -18 Td',
    '(MINI DIAGNOSTICO) Tj',
    'ET',
    'BT',
    '/F1 16 Tf',
    '50 650 Td',
    `(${safeLines[0]}) Tj`,
    '/F1 11 Tf',
    ...safeLines.slice(1).flatMap(line => ['0 -24 Td', `(${line}) Tj`]),
    'ET',
  ].join('\n');

  const imageHeader = Buffer.from(`<< /Type /XObject /Subtype /Image /Width 128 /Height 128 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${image.length} >>\nstream\n`, 'latin1');
  const imageFooter = Buffer.from('\nendstream', 'latin1');
  const objects: Buffer[] = [
    Buffer.from('<< /Type /Catalog /Pages 2 0 R >>', 'latin1'),
    Buffer.from('<< /Type /Pages /Kids [3 0 R] /Count 1 >>', 'latin1'),
    Buffer.from('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> /XObject << /Im1 5 0 R >> >> /Contents 6 0 R >>', 'latin1'),
    Buffer.from('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>', 'latin1'),
    Buffer.concat([imageHeader, image, imageFooter]),
    Buffer.from(`<< /Length ${Buffer.byteLength(content, 'latin1')} >>\nstream\n${content}\nendstream`, 'latin1'),
  ];

  const chunks: Buffer[] = [Buffer.from('%PDF-1.4\n', 'latin1')];
  const offsets: number[] = [0];
  let position = chunks[0].length;
  objects.forEach((object, index) => {
    const prefix = Buffer.from(`${index + 1} 0 obj\n`, 'latin1');
    const suffix = Buffer.from('\nendobj\n', 'latin1');
    offsets[index + 1] = position;
    chunks.push(prefix, object, suffix);
    position += prefix.length + object.length + suffix.length;
  });
  const xrefOffset = position;
  let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= objects.length; i++) xref += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  xref += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  chunks.push(Buffer.from(xref, 'latin1'));
  return Buffer.concat(chunks);
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
    let stripeSession: Stripe.Checkout.Session | null = null;

    if (!validId(id) && stripeSessionId && STRIPE_KEY) {
      stripeSession = await new Stripe(STRIPE_KEY).checkout.sessions.retrieve(stripeSessionId);
      if (stripeSession.payment_status !== 'paid') return res.status(402).json({ error: 'Pagamento ainda não confirmado.' });
      const linked = stripeSession.metadata?.quiz_session_id || stripeSession.client_reference_id || '';
      if (!validId(linked)) return res.status(400).json({ error: 'Sessão do diagnóstico inválida.' });
      id = linked;
    }

    if (!validId(id)) return res.status(400).json({ error: 'Sessão inválida.' });
    const rows = await db<any[]>(`quiz_sessions?quiz_session_id=eq.${encodeURIComponent(id)}&select=quiz_session_id,nome,score_medo,score_inseguranca,score_procrastinacao,resultado_dominante,payment_status,paid_at,stripe_checkout_session_id`);
    const q = rows[0];
    if (!q) return res.status(404).json({ error: 'Diagnóstico não encontrado.' });

    if (q.payment_status !== 'paid') {
      if (!stripeSession) {
        if (!stripeSessionId || !STRIPE_KEY) return res.status(402).json({ error: 'Pagamento ainda não confirmado.' });
        stripeSession = await new Stripe(STRIPE_KEY).checkout.sessions.retrieve(stripeSessionId);
      }
      const linked = stripeSession.metadata?.quiz_session_id || stripeSession.client_reference_id;
      if (stripeSession.payment_status !== 'paid' || linked !== id) return res.status(402).json({ error: 'Pagamento ainda não confirmado.' });

      const paidAt = new Date().toISOString();
      await db(`quiz_sessions?quiz_session_id=eq.${encodeURIComponent(id)}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Prefer: 'return=minimal' }, body: JSON.stringify({ payment_status: 'paid', paid_at: paidAt, stripe_checkout_session_id: stripeSession.id }) });
      q.payment_status = 'paid';
      q.paid_at = paidAt;
      q.stripe_checkout_session_id = stripeSession.id;
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
