import { createHash } from 'node:crypto';

type VercelRequest = {
  method?: string;
  body?: unknown;
  headers: Record<string, string | string[] | undefined>;
};

type VercelResponse = {
  status: (code: number) => VercelResponse;
  json: (data: unknown) => unknown;
};

const cleanEnv = (value: string | undefined) => {
  const trimmed = (value || '').trim();
  return trimmed.replace(/^(["'])(.*)\1$/, '$2').trim();
};

function dbConfig() {
  const url = cleanEnv(process.env.SUPABASE_URL).replace(/\/$/, '');
  // Prefer the current Supabase secret key; keep legacy service_role compatibility.
  const key = cleanEnv(process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY);

  if (!url) throw new Error('DB_CONFIG_URL_MISSING');
  if (!key || key.length < 20) throw new Error('DB_CONFIG_KEY_MISSING');
  if (key.startsWith('sb_publishable_')) throw new Error('DB_KEY_WRONG_TYPE');

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error('DB_URL_INVALID');
  }

  if (parsed.protocol !== 'https:' || !parsed.hostname.endsWith('.supabase.co')) {
    throw new Error('DB_URL_INVALID');
  }

  return { url: parsed.origin, key };
}

async function db<T>(resource: string, init: RequestInit = {}): Promise<T> {
  const { url, key } = dbConfig();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(`${url}/rest/v1/${resource}`, {
      ...init,
      signal: controller.signal,
      headers: {
        apikey: key,
        ...(key.startsWith('eyJ') ? { Authorization: `Bearer ${key}` } : {}),
        'Content-Type': 'application/json',
        ...(init.headers || {}),
      },
    });

    const text = await response.text();
    if (!response.ok) {
      console.error('Supabase quiz error', response.status, text.slice(0, 500));
      throw new Error(`DB_${response.status}`);
    }

    return text ? JSON.parse(text) as T : undefined as T;
  } catch (error: any) {
    if (error?.name === 'AbortError') throw new Error('DB_TIMEOUT');
    if (
      error?.message === 'fetch failed' ||
      ['ENOTFOUND', 'EAI_AGAIN', 'ECONNREFUSED'].includes(error?.cause?.code)
    ) {
      throw new Error('DB_CONNECTION');
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function normalizeWhatsapp(value: unknown) {
  if (typeof value !== 'string') throw new Error('WhatsApp inválido.');
  const digits = value.replace(/\D/g, '');
  const whatsapp = digits.length >= 10 && digits.length <= 11 ? `55${digits}` : digits;
  if (!/^55[1-9][0-9]{9,10}$/.test(whatsapp)) throw new Error('WhatsApp inválido.');
  return whatsapp;
}

function validateAnswers(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Respostas inválidas.');
  }

  const input = value as Record<string, unknown>;
  const keys = Object.keys(input);
  if (keys.length !== 12 || keys.some((key) => !/^([1-9]|1[0-2])$/.test(key))) {
    throw new Error('Respostas incompletas.');
  }

  const answers: Record<string, number> = {};
  for (let i = 1; i <= 12; i += 1) {
    const valueForQuestion = input[String(i)];
    if (!Number.isInteger(valueForQuestion) || Number(valueForQuestion) < 0 || Number(valueForQuestion) > 3) {
      throw new Error('Resposta inválida.');
    }
    answers[String(i)] = Number(valueForQuestion);
  }
  return answers;
}

function calculateScores(answers: Record<string, number>) {
  let medo = 0;
  let inseguranca = 0;
  let procrastinacao = 0;

  for (let i = 1; i <= 4; i += 1) medo += answers[String(i)];
  for (let i = 5; i <= 8; i += 1) inseguranca += answers[String(i)];
  for (let i = 9; i <= 12; i += 1) procrastinacao += answers[String(i)];

  let resultado_dominante = 'MEDO';
  let max = medo;
  if (inseguranca > max) {
    resultado_dominante = 'INSEGURANÇA';
    max = inseguranca;
  }
  if (procrastinacao > max) resultado_dominante = 'PROCRASTINAÇÃO';

  return {
    score_medo: medo,
    score_inseguranca: inseguranca,
    score_procrastinacao: procrastinacao,
    resultado_dominante,
  };
}

function deterministicSessionId(whatsapp: string, answers: Record<string, number>) {
  const canonical = `${whatsapp}:${JSON.stringify(answers)}`;
  const hex = createHash('sha256').update(canonical).digest('hex').slice(0, 32).split('');
  // UUID-shaped deterministic ID, stable for the same WhatsApp + answers.
  hex[12] = '5';
  hex[16] = ['8', '9', 'a', 'b'][parseInt(hex[16], 16) % 4];
  const value = hex.join('');
  return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20)}`;
}

async function findDuplicate(whatsapp: string, answers: Record<string, number>) {
  const rows = await db<any[]>(
    `quiz_sessions?whatsapp=eq.${encodeURIComponent(whatsapp)}&select=quiz_session_id,whatsapp,respostas,payment_status&limit=20`,
  );
  return rows.find(
    (row) => String(row?.whatsapp || '') === whatsapp && JSON.stringify(row?.respostas || {}) === JSON.stringify(answers),
  ) || null;
}

const errorResponse = (res: VercelResponse, error: unknown) => {
  const message = String((error as any)?.message || '');

  if (['DB_CONFIG_URL_MISSING', 'DB_CONFIG_KEY_MISSING', 'DB_KEY_WRONG_TYPE', 'DB_URL_INVALID', 'DB_CONNECTION'].includes(message)) {
    return res.status(503).json({
      error: `Supabase não configurado ou indisponível. [${message}]`,
      code: message,
    });
  }

  if (message === 'DB_TIMEOUT') {
    return res.status(504).json({
      error: `Supabase demorou para responder. [${message}]`,
      code: message,
    });
  }

  if (/^DB_\d{3}$/.test(message)) {
    return res.status(503).json({
      error: `Supabase rejeitou a operação. [${message}]`,
      code: message,
    });
  }

  return res.status(400).json({ error: message || 'Não foi possível salvar o diagnóstico.' });
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido.' });
  }

  try {
    const body = (req.body || {}) as Record<string, unknown>;
    const nome = typeof body.nome === 'string' ? body.nome.trim().replace(/\s+/g, ' ') : '';
    const whatsapp = normalizeWhatsapp(body.whatsapp);
    const respostas = validateAnswers(body.respostas);

    if (!nome || nome.length > 120) throw new Error('Nome inválido.');

    // Existing matching sessions are reused instead of creating another record.
    const duplicate = await findDuplicate(whatsapp, respostas);
    if (duplicate?.quiz_session_id) {
      return res.status(200).json({
        ok: true,
        quiz_session_id: duplicate.quiz_session_id,
        reused: true,
      });
    }

    // Deterministic ID prevents double taps / concurrent requests from creating two sessions.
    const quiz_session_id = deterministicSessionId(whatsapp, respostas);
    const row = {
      quiz_session_id,
      nome,
      whatsapp,
      respostas,
      ...calculateScores(respostas),
      payment_status: 'pending',
    };

    try {
      await db('quiz_sessions', {
        method: 'POST',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify(row),
      });
    } catch (error: any) {
      // A concurrent request may have inserted the deterministic ID first.
      if (error?.message === 'DB_409') {
        return res.status(200).json({ ok: true, quiz_session_id, reused: true });
      }
      throw error;
    }

    return res.status(201).json({ ok: true, quiz_session_id, reused: false });
  } catch (error) {
    return errorResponse(res, error);
  }
}
