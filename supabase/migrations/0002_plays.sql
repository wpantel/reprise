-- Play history: one row each time a song is marked as played.
create table public.plays (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  song_id uuid not null references public.songs (id) on delete cascade,
  played_at timestamptz not null default now(),
  felt_rusty boolean not null default false
);

create index plays_user_id_idx on public.plays (user_id);
create index plays_song_id_idx on public.plays (song_id);

alter table public.plays enable row level security;

revoke all on public.plays from anon;
grant select, insert, delete on public.plays to authenticated;

create policy "Own plays: read" on public.plays
  for select to authenticated using ((select auth.uid()) = user_id);
-- A play can only be logged against one of your own songs.
create policy "Own plays: insert" on public.plays
  for insert to authenticated with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.songs s where s.id = song_id and s.user_id = (select auth.uid()))
  );
create policy "Own plays: delete" on public.plays
  for delete to authenticated using ((select auth.uid()) = user_id);
