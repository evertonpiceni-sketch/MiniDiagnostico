type Req = { method?: string; query: Record<string, string | string[] | undefined>; headers?: Record<string, string | string[] | undefined> };
type Res = { status: (code: number) => Res; setHeader: (name: string, value: string) => void; end: (body?: any) => void; json: (data: unknown) => void };

const pdfPaths: Record<string, string> = {
  MEDO: '/result-pdf/medo.pdf',
  'INSEGURANÇA': '/result-pdf/inseguranca.pdf',
  'PROCRASTINAÇÃO': '/result-pdf/procrastinacao.pdf',
};

export default async function handler(req: Req, res: Res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Método não permitido.' });

  const pattern = String(req.query.pattern || '').toUpperCase();
  const pdfPath = pdfPaths[pattern];
  if (!pdfPath) return res.status(400).json({ error: 'Resultado inválido.' });

  const requested = String(req.query.filename || 'mini-diagnostico.pdf');
  const filename = requested.replace(/[^a-zA-Z0-9._-]/g, '-').replace(/-+/g, '-');
  const host = String(req.headers?.host || 'mini-diagnostico-chae.vercel.app');
  const proto = host.includes('localhost') ? 'http' : 'https';

  try {
    const response = await fetch(`${proto}://${host}${pdfPath}`, { cache: 'no-store' });
    if (!response.ok) throw new Error(`PDF_${response.status}`);
    const bytes = Buffer.from(await response.arrayBuffer());
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename.endsWith('.pdf') ? filename : `${filename}.pdf`}"`);
    res.setHeader('Content-Length', String(bytes.length));
    res.setHeader('Cache-Control', 'private, no-store');
    return res.status(200).end(bytes);
  } catch (error) {
    console.error('Result PDF download error', error);
    return res.status(500).json({ error: 'Não foi possível baixar o resultado em PDF.' });
  }
}
