-- Want to learn: a bookmark for songs heard but not started yet.
-- The existing grants and row-level security policies on songs already cover it.
alter table public.songs add column want_to_learn boolean not null default false;
