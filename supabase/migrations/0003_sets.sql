-- Sets: a named, ordered list of songs. Order is the order of song_ids.
create table public.sets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (length(btrim(name)) > 0),
  song_ids uuid[] not null default '{}',
  created_at timestamptz not null default now()
);

create index sets_user_id_idx on public.sets (user_id);

alter table public.sets enable row level security;

revoke all on public.sets from anon;
grant select, insert, update, delete on public.sets to authenticated;

create policy "Own sets: read" on public.sets
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Own sets: insert" on public.sets
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Own sets: update" on public.sets
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Own sets: delete" on public.sets
  for delete to authenticated using ((select auth.uid()) = user_id);
