# Reprise: initial release

A personal library of songs I can already play. Add a song in seconds, find it
by the key I play it in, open the score from the same screen.

## Decisions

- **Static web app**: Vite, React, TypeScript, Tailwind. No server, no LLM calls.
- **Storage**: Supabase (Postgres + email/password sign-in) so laptop and phone
  share one library. Row-level security limits each account to its own rows.
  Without Supabase env vars the app runs in local mode (browser storage) for
  development.
- **Key** is stored as `key_tonic` + `key_mode`, both set or both empty, so
  filters match exactly. Enharmonic keys (F# / Gb) are kept distinct.
- **One key, one arrangement per song.** Tags cover other categorization.
- **Editing saves as you go.** Key, recall and confidence edit in the row on
  desktop; everything is editable in the detail panel.
- **Look**: system fonts, light and dark, one accent (damper-felt green). The
  key badge is the signature element: filled for major, outlined for minor.

## Not in this release

Medley view, play history, sets, analytics, MIDI (see the full plan).
