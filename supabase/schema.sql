-- Ejecutar una vez en el editor SQL del proyecto Supabase.
create table if not exists public.saved_journeys (
  user_id uuid primary key references auth.users(id) on delete cascade,
  journey jsonb not null,
  updated_at timestamptz not null default now(),
  constraint journey_size_limit check (octet_length(journey::text) <= 200000)
);

alter table public.saved_journeys enable row level security;
revoke all on public.saved_journeys from anon;
grant select, insert, update, delete on public.saved_journeys to authenticated;
drop policy if exists "Users manage their own journey" on public.saved_journeys;
create policy "Users manage their own journey" on public.saved_journeys
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
