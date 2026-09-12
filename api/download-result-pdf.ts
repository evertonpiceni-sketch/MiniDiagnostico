import { PDFArray, PDFDocument, PDFName, PDFNumber, PDFString } from 'pdf-lib';

type Req = { method?: string; query: Record<string, string | string[] | undefined>; headers?: Record<string, string | string[] | undefined> };
type Res = { status: (code: number) => Res; setHeader: (name: string, value: string) => void; end: (body?: any) => void; json: (data: unknown) => void };

const pdfPaths: Record<string, string> = {
  MEDO: '/result-pdf/medo.pdf',
  'INSEGURANÇA': '/result-pdf/inseguranca.pdf',
  'PROCRASTINAÇÃO': '/result-pdf/procrastinacao.pdf',
};

function addWhatsAppLink(pdf: PDFDocument, url: string) {
  const page = pdf.getPages()[0];
  if (!page) return;
  const { width, height } = page.getSize();
  const rect = PDFArray.withContext(pdf.context);
  [width * 0.13, height * (1 - 0.79 - 0.056), width * 0.87, height * (1 - 0.79)].forEach(value => rect.push(PDFNumber.of(value)));
  const action = pdf.context.obj({ S: PDFName.of('URI'), URI: PDFString.of(url) });
  const annotation = pdf.context.obj({ Type: PDFName.of('Annot'), Subtype: PDFName.of('Link'), Rect: rect, Border: [0, 0, 0], A: action });
  const annotationRef = pdf.context.register(annotation);
  const existing = page.node.lookupMaybe(PDFName.of('Annots'), PDFArray);
  const annots = existing || PDFArray.withContext(pdf.context);
  annots.push(annotationRef);
  if (!existing) page.node.set(PDFName.of('Annots'), annots);
}

export default async function handler(req: Req, res: Res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Método não permitido.' });
  const pattern = String(req.query.pattern || '').toUpperCase();
  const pdfPath = pdfPaths[pattern];
  if (!pdfPath) return res.status(400).json({ error: 'Resultado inválido.' });

  const requested = String(req.query.filename || 'mini-diagnostico.pdf');
  const filename = requested.replace(/[^a-zA-Z0-9._-]/g, '-').replace(/-+/g, '-');
  const name = String(req.query.name || '').trim();
  const host = String(req.headers?.host || 'mini-diagnostico-chae.vercel.app');
  const proto = host.includes('localhost') ? 'http' : 'https';
  const identity = name ? `Meu nome é ${name} e meu padrão predominante foi ${pattern}.` : `Meu padrão predominante foi ${pattern}.`;
  const message = `Olá, Janaína! ${identity}\n\nFiz o Mini Diagnóstico e gostaria de aprofundar meu resultado: ${pattern}.\n\nVim pelo Mini Diagnóstico — Janaína Araújo.`;
  const whatsapp = `https://wa.me/5521983928113?text=${encodeURIComponent(message)}`;

  try {
    const response = await fetch(`${proto}://${host}${pdfPath}`, { cache: 'no-store' });
    if (!response.ok) throw new Error(`PDF_${response.status}`);
    const pdf = await PDFDocument.load(await response.arrayBuffer());
    addWhatsAppLink(pdf, whatsapp);
    const bytes = Buffer.from(await pdf.save());
    const finalName = filename.endsWith('.pdf') ? filename : `${filename}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${finalName}"; filename*=UTF-8''${encodeURIComponent(finalName)}`);
    res.setHeader('Content-Length', String(bytes.length));
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'private, no-store, max-age=0');
    return res.status(200).end(bytes);
  } catch (error) {
    console.error('Result PDF download error', error);
    return res.status(500).json({ error: 'Não foi possível baixar o resultado em PDF.' });
  }
}
