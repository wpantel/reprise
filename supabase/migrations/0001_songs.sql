-- Reprise: one row per song, private to the account that created it.
create table public.songs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null check (length(btrim(title)) > 0),
  artist text,
  key_tonic text check (key_tonic in
    ('C','C#','Db','D','D#','Eb','E','F','F#','Gb','G','G#','Ab','A','A#','Bb','B')),
  key_mode text check (key_mode in ('major','minor')),
  recall text check (recall in ('memorized','with_score','by_ear')),
  confidence smallint check (confidence between 1 and 5),
  arrangement_url text,
  arrangement_type text check (arrangement_type in ('musescore','pdf','other')),
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  -- A key is a tonic plus a mode, or nothing at all.
  constraint songs_key_complete check ((key_tonic is null) = (key_mode is null)),
  constraint songs_arrangement_complete check ((arrangement_url is null) = (arrangement_type is null))
);

create index songs_user_id_idx on public.songs (user_id);

alter table public.songs enable row level security;

revoke all on public.songs from anon;
grant select, insert, update, delete on public.songs to authenticated;

create policy "Own songs: read" on public.songs
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Own songs: insert" on public.songs
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Own songs: update" on public.songs
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Own songs: delete" on public.songs
  for delete to authenticated using ((select auth.uid()) = user_id);
