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
2. In the SQL Editor, run each file in `supabase/migrations/` in order
   (`0001` to `0004`). Already set up? Run any you haven't yet, such as
   `0004_want_to_learn.sql`, before deploying: the app won't load your songs
   until the newest one is in.
3. Copy `.env.example` to `.env.local` and fill in the project URL and the
   publishable (anon) key from Project Settings > API.
4. Restart `npm run dev`, then create your account on the sign-in screen.

Row-level security limits every account to its own songs, so the publishable
key is safe to ship in the built site.

## Install on your phone

Open the deployed site, then:

- **iPhone:** in Safari, tap Share, then Add to Home Screen.
- **Android:** in Chrome, tap Install app (or the menu, then Install).

The installed app opens with no connection. It shows your library as of the
last time it synced, and plays you log offline are kept on the phone and sent
when you're back online. Other edits need a connection. The service worker only
runs in production builds (`npm run build && npm run preview`), not in `npm run dev`.

## Want to learn

Bookmark a song you've heard but haven't started: tap Want to learn in its
details, or add `bookmark:` (or `bookmark: yes`) to a typed title. Bookmarked
songs stay out of Revive, Analytics, Medley and set suggestions until you take
the bookmark off; a song with no confidence then starts at pp.

## Shortcuts

- `N` jump to Quick Add
- `/` jump to search
- `Esc` close a panel

## Scripts

- `npm test` unit tests for parsing, duplicate detection and filters
- `npm run build` type-check and build to `dist/`
