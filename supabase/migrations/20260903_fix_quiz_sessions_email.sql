-- Production fix: the frontend does not collect email.
-- Make email nullable so quiz creation can succeed without an email address.
-- Safe to run against an existing quiz_sessions table.

alter table public.quiz_sessions
  alter column email drop not null;
