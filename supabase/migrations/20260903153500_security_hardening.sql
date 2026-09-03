-- Final security hardening applied to project aokdwgvwcsyqfhrgrboo on 2026-09-03.
-- The browser talks only to Vercel APIs. Database access uses a server-side secret key.

revoke all privileges on table public.quiz_sessions from anon, authenticated;

revoke all privileges on table public.profiles from anon;
revoke insert, delete, truncate, references, trigger on table public.profiles from authenticated;
revoke update on table public.profiles from authenticated;
grant select on table public.profiles to authenticated;
grant update (consent_lgpd_at) on table public.profiles to authenticated;

drop policy if exists "Users can read own profile" on public.profiles;
drop policy if exists "Users can update own profile" on public.profiles;
drop policy if exists users_read_own_profile on public.profiles;
drop policy if exists users_update_own_profile on public.profiles;

create policy users_read_own_profile
on public.profiles for select
to authenticated
using ((select auth.uid()) = id);

create policy users_update_own_profile
on public.profiles for update
to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.is_admin() from public, anon, authenticated;
revoke execute on function public.is_admin(uuid) from public, anon, authenticated;
revoke execute on function public.is_premium() from public, anon, authenticated;
revoke execute on function public.is_pro(uuid) from public, anon, authenticated;

grant execute on function public.handle_new_user() to service_role;
grant execute on function public.is_admin() to service_role;
grant execute on function public.is_admin(uuid) to service_role;
grant execute on function public.is_premium() to service_role;
grant execute on function public.is_pro(uuid) to service_role;

alter table public.profiles drop constraint if exists profiles_role_allowed;
alter table public.profiles add constraint profiles_role_allowed check (role in ('user','admin'));

alter table public.profiles drop constraint if exists profiles_plan_allowed;
alter table public.profiles add constraint profiles_plan_allowed check (plan in ('free','pro'));

alter table public.quiz_sessions drop constraint if exists quiz_sessions_payment_status_allowed;
alter table public.quiz_sessions add constraint quiz_sessions_payment_status_allowed check (payment_status in ('pending','paid'));
