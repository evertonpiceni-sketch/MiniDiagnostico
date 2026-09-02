import type { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(_req: VercelRequest, res: VercelResponse) {
  const db = Boolean((process.env.SUPABASE_URL || '').trim() && (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim().length >= 20);
  const stripe = Boolean((process.env.STRIPE_SECRET_KEY || '').trim() && (process.env.STRIPE_PRICE_ID || '').trim());
  return res.status(200).json({ status: 'ok', databaseConfigured: db, stripeConfigured: stripe });
}
