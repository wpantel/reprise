# Reprise

A personal library of the songs you can play: add a song in seconds, find it by
the key you play it in, and open your score from the same screen.

## Run it

```bash
npm install
npm run dev
```

Without Supabase keys the app runs in **local mode**: songs are saved in that
browser only.

## Sync across devices with Supabase (free tier)

1. Create a project at supabase.com.
2. In the SQL Editor, run `supabase/migrations/0001_songs.sql`.
3. Copy `.env.example` to `.env.local` and fill in the project URL and the
   publishable (anon) key from Project Settings > API.
4. Restart `npm run dev`, then create your account on the sign-in screen.

Row-level security limits every account to its own songs, so the publishable
key is safe to ship in the built site.

## Shortcuts

- `N` jump to Quick Add
- `/` jump to search
- `Esc` close a panel

## Scripts

- `npm test` unit tests for parsing, duplicate detection and filters
- `npm run build` type-check and build to `dist/`
