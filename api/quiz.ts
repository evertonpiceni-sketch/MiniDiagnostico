import { createHmac, randomUUID } from 'node:crypto';
import { enforceRateLimit } from './_rate-limit.js';

type VercelRequest = {
  method?: string;
  body?: unknown;
  headers: Record<string, string | string[] | undefined>;
};

type VercelResponse = {
  status: (code: number) => VercelResponse;
  json: (data: unknown) => unknown;
  setHeader: (name: string, value: string) => void;
};

const cleanEnv = (value: string | undefined) => {
  const trimmed = (value || '').trim();
  return trimmed.replace(/^(["'])(.*)\1$/, '$2').trim();
};

const RESULT_TOKEN_SECRET = cleanEnv(process.env.RESULT_TOKEN_SECRET);

function recoveryProof(id: string) {
  if (RESULT_TOKEN_SECRET.length < 32) throw new Error('RESULT_TOKEN_SECRET_INVALID');
  return createHmac('sha256', RESULT_TOKEN_SECRET).update(`recovery:${id}`).digest('base64url');
}

function setRecoveryCookie(res: VercelResponse, id: string) {
  const proof = recoveryProof(id);
  res.setHeader('Set-Cookie', `mini_recovery_${id}=${encodeURIComponent(proof)}; Path=/api/quiz/${id}; Max-Age=604800; HttpOnly; Secure; SameSite=Lax`);
}

function dbConfig() {
  const url = cleanEnv(process.env.SUPABASE_URL).replace(/\/$/, '');
  const key = [process.env.SUPABASE_SERVICE_ROLE_KEY, process.env.SUPABASE_SECRET_KEY]
    .map(cleanEnv)
    .find((candidate) => Boolean(candidate) && !candidate.startsWith('sb_publishable_')) || '';

  if (!url) throw new Error('DB_CONFIG_URL_MISSING');
  if (!key || key.length < 20) throw new Error('DB_CONFIG_KEY_MISSING');

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

const RESULT_PATTERNS = ['MEDO', 'INSEGURANÇA', 'PROCRASTINAÇÃO'] as const;
type ResultPattern = typeof RESULT_PATTERNS[number];

export function calculateScores(answers: Record<string, number>, desempate?: unknown) {
  let medo = 0;
  let inseguranca = 0;
  let procrastinacao = 0;

  for (let i = 1; i <= 4; i += 1) medo += answers[String(i)];
  for (let i = 5; i <= 8; i += 1) inseguranca += answers[String(i)];
  for (let i = 9; i <= 12; i += 1) procrastinacao += answers[String(i)];

  const scores: Record<ResultPattern, number> = { MEDO: medo, INSEGURANÇA: inseguranca, PROCRASTINAÇÃO: procrastinacao };
  const max = Math.max(...Object.values(scores));
  const tied = RESULT_PATTERNS.filter(pattern => scores[pattern] === max);
  let resultado_dominante: ResultPattern;
  if (tied.length === 1) resultado_dominante = tied[0];
  else {
    if (typeof desempate !== 'string' || !tied.includes(desempate as ResultPattern)) {
      throw new Error('Responda à pergunta complementar para definir o resultado do empate.');
    }
    resultado_dominante = desempate as ResultPattern;
  }

  return {
    score_medo: medo,
    score_inseguranca: inseguranca,
    score_procrastinacao: procrastinacao,
    resultado_dominante,
  };
}

async function findDuplicate(whatsapp: string, answers: Record<string, number>, resultado: ResultPattern) {
  const rows = await db<any[]>(
    `quiz_sessions?whatsapp=eq.${encodeURIComponent(whatsapp)}&payment_status=eq.pending&select=quiz_session_id,whatsapp,respostas,resultado_dominante,payment_status&order=created_at.desc&limit=20`,
  );
  return rows.find(
    (row) => String(row?.whatsapp || '') === whatsapp && row?.resultado_dominante === resultado && JSON.stringify(row?.respostas || {}) === JSON.stringify(answers),
  ) || null;
}

const errorResponse = (res: VercelResponse, error: unknown) => {
  const message = String((error as any)?.message || '');

  if (['DB_CONFIG_URL_MISSING', 'DB_CONFIG_KEY_MISSING', 'DB_URL_INVALID', 'DB_CONNECTION', 'RESULT_TOKEN_SECRET_INVALID'].includes(message)) {
    return res.status(503).json({
      error: `Serviço não configurado ou indisponível. [${message}]`,
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

  res.setHeader('Cache-Control', 'private, no-store');
  if (!enforceRateLimit(req, res, 'quiz-create', 8, 10 * 60_000)) return;

  try {
    const body = (req.body || {}) as Record<string, unknown>;
    const nome = typeof body.nome === 'string' ? body.nome.trim().replace(/\s+/g, ' ') : '';
    const whatsapp = normalizeWhatsapp(body.whatsapp);
    const respostas = validateAnswers(body.respostas);
    const scores = calculateScores(respostas, body.desempate);

    if (!nome || nome.length > 120) throw new Error('Nome inválido.');

    const duplicate = await findDuplicate(whatsapp, respostas, scores.resultado_dominante);
    if (duplicate?.quiz_session_id) {
      setRecoveryCookie(res, duplicate.quiz_session_id);
      return res.status(200).json({
        ok: true,
        quiz_session_id: duplicate.quiz_session_id,
        reused: true,
      });
    }

    const quiz_session_id = randomUUID();
    const row = {
      quiz_session_id,
      nome,
      whatsapp,
      respostas,
      ...scores,
      payment_status: 'pending',
    };

    await db('quiz_sessions', {
      method: 'POST',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify(row),
    });

    setRecoveryCookie(res, quiz_session_id);
    return res.status(201).json({ ok: true, quiz_session_id, reused: false });
  } catch (error) {
    return errorResponse(res, error);
  }
}
