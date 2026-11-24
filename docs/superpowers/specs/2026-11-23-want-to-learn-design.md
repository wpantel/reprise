# Want to learn

## Why

Reprise holds songs I can play. I also want to keep songs I've heard and want to
work on but haven't touched yet, without them looking like repertoire. Songs I've
started stay as they are: confidence pp already means "still learning".

## Goals

- Mark any song "Want to learn" with one on/off bookmark toggle.
- See those songs in the library, clearly set apart.
- Keep them out of everything that assumes I can play the song.

## Non-goals

- A separate queue, ordering, or progress tracking for learning songs.
- Changing what the confidence scale means.

## Anti-goals

- Clutter on the rows of songs I already play.
- A "magic" tag whose name changes behavior.

## Approaches

1. **A new on/off field on each song (picked).** One `want_to_learn` column;
   every view checks it directly. Costs one small migration.
2. Preset tag with special styling. No migration, but a reserved word inside
   free-form tags: retyping or renaming it silently changes behavior.
3. New confidence level below pp. Rejected: "not started" isn't a confidence,
   and it would skew Analytics and break the pp to ff dynamics scale.

## Design

**Data.** `songs.want_to_learn boolean not null default false`, added in
`supabase/migrations/0004_want_to_learn.sql`. `Song` gets `want_to_learn:
boolean`; the Supabase select list, local store and offline cache carry it, and
rows saved before this change read as `false`.

**Icon.** Tabler-style outline bookmark, drawn like the existing `Star`: outline
when off, filled in the accent green when on.

**Where it shows.**
- Song detail panel: the bookmark toggle, labelled "Want to learn", always
  visible. This is the only place to turn it on or off.
- Library row: only when on, a filled bookmark plus a dashed "Want to learn"
  label next to the title. Nothing extra on rows where it's off.

**Where it's left out.** Want-to-learn songs don't appear in Revive (neither due
nor unplayed), Analytics totals, Medley results, or the song picker when adding to
a set. Existing sets that already contain one keep it.

**Finding them.** The filter bar gets a "Want to learn" option, so the library
can show just these songs or hide them.

## Builder's calls (mine, to check)

**Typing it.** Quick Add and Bulk Add read a `bookmark:` tag the way they read
`key:` and `confidence:` (case-insensitive, any position):
- `bookmark:` with nothing after it, or followed straight by another tag → on.
- `bookmark: yes` → on.
- `bookmark: no`, or no `bookmark:` tag at all → off.
- `bookmark:` at the very start of the title → on, and the text after it is
  the title (`bookmark: Clair de lune`).

## Builder's calls (mine, to check)

- Any other value (`bookmark: maybe`) isn't understood, so the text stays in
  the title, matching how other tags handle values they don't understand.
- Turning the bookmark off sets confidence to pp when the song has no
  confidence yet; an existing rating is left alone.
- Logging a play on a want-to-learn song doesn't change the bookmark.
- Unit tests cover `bookmark:` parsing, the filter, and the Revive/Analytics/Medley
  exclusions.
- README gets a line on running the new migration.
