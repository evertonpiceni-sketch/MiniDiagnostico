create table if not exists public.quiz_sessions (
  quiz_session_id uuid primary key,
  nome text not null check (char_length(nome) between 1 and 120),
  email text,
  whatsapp text not null check (whatsapp ~ '^55[1-9][0-9]{9,10}$'),
  respostas jsonb not null,
  score_medo integer not null check (score_medo between 0 and 12),
  score_inseguranca integer not null check (score_inseguranca between 0 and 12),
  score_procrastinacao integer not null check (score_procrastinacao between 0 and 12),
  resultado_dominante text not null check (resultado_dominante in ('MEDO', 'INSEGURANÇA', 'PROCRASTINAÇÃO')),
  payment_status text not null default 'pending' check (payment_status in ('pending', 'paid')),
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  stripe_checkout_session_id text unique,
  email_sent_at timestamptz,
  result_access_token_hash text,
  whatsapp_delivery_status text not null default 'pending'
    check (whatsapp_delivery_status in ('pending', 'processing', 'accepted', 'sent', 'delivered', 'read', 'failed')),
  whatsapp_claimed_at timestamptz,
  whatsapp_sent_at timestamptz,
  whatsapp_message_id text,
  whatsapp_attempts integer not null default 0 check (whatsapp_attempts >= 0),
  whatsapp_last_error text
);

alter table public.quiz_sessions alter column email drop not null;
alter table public.quiz_sessions enable row level security;

create index if not exists quiz_sessions_created_at_idx on public.quiz_sessions (created_at desc);
create index if not exists quiz_sessions_payment_status_idx on public.quiz_sessions (payment_status);
create index if not exists quiz_sessions_whatsapp_delivery_idx
  on public.quiz_sessions (payment_status, whatsapp_delivery_status, whatsapp_claimed_at);
create unique index if not exists quiz_sessions_whatsapp_message_id_idx
  on public.quiz_sessions (whatsapp_message_id)
  where whatsapp_message_id is not null;
