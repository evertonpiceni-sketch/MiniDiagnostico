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
  email_sent_at timestamptz
);

alter table public.quiz_sessions alter column email drop not null;
alter table public.quiz_sessions enable row level security;

create index if not exists quiz_sessions_created_at_idx on public.quiz_sessions (created_at desc);
create index if not exists quiz_sessions_payment_status_idx on public.quiz_sessions (payment_status);
