-- Reliable paid-result delivery and access-token protection.
-- Existing paid rows remain readable through Stripe recovery, but new checkouts
-- receive a dedicated result token and WhatsApp delivery lifecycle.

alter table public.quiz_sessions
  add column if not exists result_access_token_hash text,
  add column if not exists whatsapp_delivery_status text not null default 'pending',
  add column if not exists whatsapp_claimed_at timestamptz,
  add column if not exists whatsapp_sent_at timestamptz,
  add column if not exists whatsapp_message_id text,
  add column if not exists whatsapp_attempts integer not null default 0,
  add column if not exists whatsapp_last_error text;

alter table public.quiz_sessions
  drop constraint if exists quiz_sessions_whatsapp_delivery_status_check;
alter table public.quiz_sessions
  add constraint quiz_sessions_whatsapp_delivery_status_check
  check (whatsapp_delivery_status in ('pending', 'processing', 'accepted', 'sent', 'delivered', 'read', 'failed'));

alter table public.quiz_sessions
  drop constraint if exists quiz_sessions_whatsapp_attempts_check;
alter table public.quiz_sessions
  add constraint quiz_sessions_whatsapp_attempts_check
  check (whatsapp_attempts >= 0);

create index if not exists quiz_sessions_whatsapp_delivery_idx
  on public.quiz_sessions (payment_status, whatsapp_delivery_status, whatsapp_claimed_at);
create unique index if not exists quiz_sessions_whatsapp_message_id_idx
  on public.quiz_sessions (whatsapp_message_id)
  where whatsapp_message_id is not null;

revoke all privileges on table public.quiz_sessions from anon, authenticated;
alter table public.quiz_sessions enable row level security;
