import { createHmac, timingSafeEqual } from 'node:crypto';

type Req = { method?: string; query: Record<string, string | string[] | undefined> };
type Res = { status: (code: number) => Res; setHeader: (name: string, value: string) => void; end: (body?: any) => void; json: (data: unknown) => void };

const clean = (value?: string) => (value || '').trim().replace(/^["'](.*)["']$/, '$1').trim();
const validId = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);

function validToken(id: string, token: string, secret: string) {
  if (secret.length < 32 || !token) return false;
  const expected = Buffer.from(createHmac('sha256', secret).update(`result:${id}`).digest('base64url'));
  const supplied = Buffer.from(token);
  return expected.length === supplied.length && timingSafeEqual(expected, supplied);
}

async function db(resource: string, dbUrl: string, dbKey: string) {
  if (!dbUrl || !dbKey) throw new Error('DB_CONFIG');
  const response = await fetch(`${dbUrl}/rest/v1/${resource}`, {
    headers: {
      apikey: dbKey,
      ...(dbKey.startsWith('eyJ') ? { Authorization: `Bearer ${dbKey}` } : {}),
    },
  });
  if (!response.ok) throw new Error(`DB_${response.status}`);
  return response.json();
}

const pdfPaths: Record<string, string> = {
  MEDO: '/result-pdf/medo.pdf',
  'INSEGURANÇA': '/result-pdf/inseguranca.pdf',
};

export default async function handler(req: Req, res: Res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Método não permitido.' });

  try {
    const dbUrl = clean(process.env.SUPABASE_URL).replace(/\/$/, '');
    const dbKey = [process.env.SUPABASE_SERVICE_ROLE_KEY, process.env.SUPABASE_SECRET_KEY]
      .map(clean)
      .find(key => Boolean(key) && !key.startsWith('sb_publishable_')) || '';
    const secret = clean(process.env.RESULT_TOKEN_SECRET);

    const id = String(req.query.id || '');
    const token = String(req.query.token || '');
    if (!validId(id)) return res.status(400).json({ error: 'Sessão inválida.' });
    if (!validToken(id, token, secret)) return res.status(403).json({ error: 'Acesso ao PDF não autorizado.' });

    const rows: any = await db(
      `quiz_sessions?quiz_session_id=eq.${encodeURIComponent(id)}&select=quiz_session_id,resultado_dominante,payment_status`,
      dbUrl,
      dbKey,
    );
    const result = rows?.[0];
    if (!result) return res.status(404).json({ error: 'Diagnóstico não encontrado.' });
    if (result.payment_status !== 'paid') return res.status(402).json({ error: 'Pagamento ainda não confirmado.' });

    const pattern = String(result.resultado_dominante);
    if (pattern === 'PROCRASTINAÇÃO') {
      // Procrastinação is rendered from the approved on-screen result.
      // Never redirect this result to the obsolete static PDF.
      res.status(409);
      res.setHeader('Cache-Control', 'private, no-store');
      return res.json({ error: 'PDF estático de procrastinação desativado. Use o resultado exibido para salvar em PDF.' });
    }

    const pdfPath = pdfPaths[pattern] || pdfPaths.MEDO;
    res.status(302);
    res.setHeader('Location', pdfPath);
    res.setHeader('Cache-Control', 'private, no-store');
    return res.end();
  } catch (error) {
    console.error('PDF endpoint error', error);
    return res.status(500).json({ error: 'Não foi possível preparar o diagnóstico em PDF.' });
  }
}
