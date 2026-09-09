const buckets = new Map();

function header(headers, name) {
  const value = headers[name] ?? headers[name.toLowerCase()];
  return Array.isArray(value) ? value[0] || '' : String(value || '');
}

function clientIp(req) {
  const forwarded = header(req.headers, 'x-forwarded-for').split(',')[0]?.trim();
  return forwarded || header(req.headers, 'x-real-ip') || 'unknown';
}

export function enforceRateLimit(req, res, scope, limit = 12, windowMs = 60_000) {
  const now = Date.now();
  if (buckets.size > 2_000) {
    for (const [key, bucket] of buckets) if (bucket.resetAt <= now) buckets.delete(key);
  }
  const key = `${scope}:${clientIp(req)}`;
  const current = buckets.get(key);
  const bucket = !current || current.resetAt <= now ? { count: 0, resetAt: now + windowMs } : current;
  bucket.count += 1;
  buckets.set(key, bucket);
  const remaining = Math.max(0, limit - bucket.count);
  res.setHeader('X-RateLimit-Limit', String(limit));
  res.setHeader('X-RateLimit-Remaining', String(remaining));
  res.setHeader('X-RateLimit-Reset', String(Math.ceil(bucket.resetAt / 1000)));
  if (bucket.count <= limit) return true;
  res.setHeader('Retry-After', String(Math.max(1, Math.ceil((bucket.resetAt - now) / 1000))));
  res.status(429).json({ error: 'Muitas tentativas. Aguarde um momento e tente novamente.' });
  return false;
}
