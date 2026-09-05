alter table public.quiz_sessions
  add column if not exists asaas_payment_id text;

create unique index if not exists quiz_sessions_asaas_payment_id_uidx
  on public.quiz_sessions (asaas_payment_id)
  where asaas_payment_id is not null;
