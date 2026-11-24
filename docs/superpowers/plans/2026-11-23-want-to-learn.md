# Want to Learn Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let any song be bookmarked "Want to learn", shown apart in the library and left out of Revive, Analytics, Medley and the set picker.

**Architecture:** One new boolean column `want_to_learn` on `songs`, carried through the `Song` type, both stores, the optimistic insert and the offline snapshot. Pure helpers in `src/lib` (tag parsing, filter, `playableSongs`, `bookmarkPatch`) carry the rules and are unit-tested; components only wire them up.

**Tech Stack:** Vite, React 19, TypeScript, Tailwind 4, Supabase, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-23-want-to-learn-design.md`

## Global Constraints

- Work on branch `feature/want-to-learn` off `main`.
- Column: `want_to_learn boolean not null default false`, migration file `supabase/migrations/0004_want_to_learn.sql`.
- UI copy, exactly: "Want to learn" (detail toggle label and row label).
- Icon: outline bookmark when off, filled in the accent green when on, drawn like `Star` in `src/components/StandView.tsx` (16×16 viewBox, `currentColor`, stroke 1.4, `h-[1em] w-[1em]`).
- Toggle lives only in the song detail panel; rows show the bookmark and label only when on.
- Tag syntax: `bookmark:` empty or `yes` → on; `no` → off; any other value stays in the title.
- Commits and PRs carry no Claude attribution (CLAUDE.md).

## Review Focus

1. **Supabase not migrated yet:** the select list names `want_to_learn`, so an unmigrated project fails to load. README must tell the user to run `0004` before deploying (Task 4).
2. **Old saved data:** browser-only songs and offline snapshots written before this change have no `want_to_learn`; they must read as `false`, not `undefined` (Task 1 test).
3. **Analytics tile → library:** Analytics counts only playable songs, so the library view a tile opens must hide bookmarked songs too, or the numbers won't match (Task 4, via `bookmarked: false`).
4. **Tag edge cases:** `Bookmark: Yes.` (case, trailing period), `bookmark:no` (no space), and a title that merely contains the word "bookmark" with no colon (Task 2 tests).
5. **Existing sets:** a set that already holds a song later bookmarked still lists it; only the "add songs" search and swap suggestions skip it (Task 3 test for swaps, Task 4 browser check for the set).

---

### Task 1: Store the field

**Files:**
- Create: `supabase/migrations/0004_want_to_learn.sql`
- Modify: `src/lib/songs.ts` (`Song`, `NewSong`, new `normalizeSong`)
- Modify: `src/lib/store.ts` (`COLUMNS`, `supabaseStore.insert`, `localStore.insert`, `read`)
- Modify: `src/lib/useSongs.ts:131-144` (optimistic `temp` song)
- Modify: `src/lib/offline.ts` (`readSnapshot`)
- Test: `src/lib/lib.test.ts` (`song()` factory gains `want_to_learn: false`; new cases in `describe('offline copy')`)
- Also commit: `docs/superpowers/specs/2026-11-23-want-to-learn-design.md`, this plan

**Interfaces:**
- Produces: `Song.want_to_learn: boolean`; `NewSong.want_to_learn?: boolean`; `normalizeSong(raw: Omit<Song, 'want_to_learn'> & { want_to_learn?: boolean }): Song` in `src/lib/songs.ts`.

- [ ] **Step 1: Create the branch** — `git switch -c feature/want-to-learn`

- [ ] **Step 2: Write the failing tests**

```ts
it('reads songs saved before want_to_learn existed as not bookmarked', () => {
  const { want_to_learn: _, ...old } = song({ title: 'Old' })
  expect(normalizeSong(old).want_to_learn).toBe(false)
  expect(normalizeSong({ ...old, want_to_learn: true }).want_to_learn).toBe(true)
})
it('fills want_to_learn on an offline snapshot written before it existed', () => {
  // memory Storage as the existing offline tests build it; write a snapshot
  // whose song lacks want_to_learn straight to `reprise.snapshot.v1.<user>`
  expect(offlineCache('u', storage).readSnapshot()!.songs[0].want_to_learn).toBe(false)
})
```

- [ ] **Step 3: Run** `npm test` — Expected: FAIL (`normalizeSong` not exported).

- [ ] **Step 4: Implement**
  - Migration: `alter table public.songs add column want_to_learn boolean not null default false;` (existing grants and policies already cover it).
  - `normalizeSong` returns `{ ...raw, want_to_learn: raw.want_to_learn ?? false }`.
  - `COLUMNS` appends `want_to_learn`; both `insert`s write `want_to_learn: s.want_to_learn ?? false`; `localStore`'s `read()` maps through `normalizeSong`; `readSnapshot` maps `songs` through `normalizeSong`; the optimistic `temp` song sets `want_to_learn: d.want_to_learn ?? false`.

- [ ] **Step 5: Run** `npm test && npm run build` — Expected: all pass, no type errors.

- [ ] **Step 6: Commit** — `git add -A && git commit -m "Store a want-to-learn bookmark on each song"`

---

### Task 2: `bookmark:` in typed titles

**Files:**
- Modify: `src/lib/tags.ts` (`ParsedSong`, `parseTags`, doc comment)
- Test: `src/lib/lib.test.ts` (`describe('tags in typed titles')`, one case in `describe('bulk add')`)

**Interfaces:**
- Consumes: `NewSong.want_to_learn` (Task 1).
- Produces: `ParsedSong` includes `want_to_learn`; `parseTags` sets it only when a `bookmark:` tag is understood. `parseBulk` passes it through unchanged.

- [ ] **Step 1: Write the failing tests**

```ts
expect(parseTags('Clair de lune bookmark:')).toEqual({ title: 'Clair de lune', artist: null, want_to_learn: true })
expect(parseTags('Clair de lune bookmark: artist: Debussy')).toMatchObject({ title: 'Clair de lune', artist: 'Debussy', want_to_learn: true })
expect(parseTags('Clair de lune Bookmark: Yes.').want_to_learn).toBe(true)
expect(parseTags('Clair de lune bookmark:no')).toEqual({ title: 'Clair de lune', artist: null, want_to_learn: false })
expect(parseTags('Clair de lune bookmark: maybe')).toEqual({ title: 'Clair de lune bookmark: maybe', artist: null })
expect(parseTags('The bookmark song').want_to_learn).toBeUndefined()
expect(parseBulk('Clair de lune bookmark:\nGymnopédie', false).map((s) => s.want_to_learn)).toEqual([true, undefined])
```

- [ ] **Step 2: Run** `npm test` — Expected: FAIL on the bookmark cases.

- [ ] **Step 3: Implement** — add `bookmark` to the tag regex alternation; in the loop, strip a trailing period from the value as `parseKey` does, then lower-cased `''` or `'yes'` → `song.want_to_learn = true`, `'no'` → `false`, anything else `continue` (text stays in the title). Add `'want_to_learn'` to the `ParsedSong` pick. Update the doc comment to list `bookmark:`.

- [ ] **Step 4: Run** `npm test` — Expected: PASS.

- [ ] **Step 5: Commit** — `git commit -am "Read a bookmark: tag in typed song titles"`

---

### Task 3: Filter, playable songs, and the bookmark patch

**Files:**
- Modify: `src/lib/filters.ts` (`Filters`, `EMPTY_FILTERS`, `hasActiveFilters`, `matches`)
- Modify: `src/lib/songs.ts` (new `playableSongs`, `bookmarkPatch`)
- Modify: `src/lib/medley.ts` (`swapCandidates`)
- Test: `src/lib/lib.test.ts` (`describe('filters')`, `describe('medley and sets')`, new `describe('want to learn')`)

**Interfaces:**
- Produces:
  - `Filters.bookmarked: boolean | null` — `true` only bookmarked, `false` hide bookmarked, `null` any.
  - `playableSongs<T extends Song>(songs: T[]): T[]` — songs with `want_to_learn` false.
  - `bookmarkPatch(song: Song, on: boolean): SongPatch` — `{ want_to_learn: on }`, plus `confidence: 1` when turning off a song with `confidence === null`.

- [ ] **Step 1: Write the failing tests**

```ts
const a = song({ title: 'A' }), b = song({ title: 'B', want_to_learn: true })
expect([a, b].filter((s) => matches(s, { ...EMPTY_FILTERS, bookmarked: true }))).toEqual([b])
expect([a, b].filter((s) => matches(s, { ...EMPTY_FILTERS, bookmarked: false }))).toEqual([a])
expect(hasActiveFilters({ ...EMPTY_FILTERS, bookmarked: false })).toBe(true)
expect(playableSongs([a, b])).toEqual([a])
expect(bookmarkPatch(song({}), true)).toEqual({ want_to_learn: true })
expect(bookmarkPatch(song({ want_to_learn: true }), false)).toEqual({ want_to_learn: false, confidence: 1 })
expect(bookmarkPatch(song({ want_to_learn: true, confidence: 3 }), false)).toEqual({ want_to_learn: false })
// swapCandidates skips a bookmarked song in the same key
const c = song({ title: 'C', key_tonic: 'D', key_mode: 'major' })
const d = song({ title: 'D', key_tonic: 'D', key_mode: 'major', want_to_learn: true })
expect(swapCandidates(c, [c, d], [c.id])).toEqual([])
```

- [ ] **Step 2: Run** `npm test` — Expected: FAIL.

- [ ] **Step 3: Implement** the three helpers and the filter field (`EMPTY_FILTERS.bookmarked = null`; `matches` rejects when `f.bookmarked !== null && song.want_to_learn !== f.bookmarked`). `swapCandidates` filters with `!s.want_to_learn`.

- [ ] **Step 4: Run** `npm test && npm run build` — Expected: PASS (fix any call site that builds a `Filters` literal).

- [ ] **Step 5: Commit** — `git commit -am "Add want-to-learn filter and keep bookmarked songs out of swaps"`

---

### Task 4: Bookmark in the UI and views

**Files:**
- Modify: `src/components/StandView.tsx` (export `Bookmark({ filled })` next to the exported `Star`)
- Modify: `src/components/SongDetail.tsx` (toggle after the Confidence block, ~line 214)
- Modify: `src/components/SongRow.tsx` (bookmark + label beside the title when on)
- Modify: `src/components/FilterBar.tsx` (option in `FilterControls`, chip in `FilterSummary` ~line 182)
- Modify: `src/components/Library.tsx:235-262` (view wiring)
- Modify: `src/components/SetsView.tsx:190-192` (add-songs search)
- Modify: `README.md`

**Interfaces:**
- Consumes: `bookmarkPatch`, `playableSongs`, `Filters.bookmarked` (Task 3).

- [ ] **Step 1: Implement**
  - `Bookmark({ filled }: { filled: boolean })`: bookmark outline path, same SVG conventions as `Star`.
  - SongDetail: a toggle button with `aria-pressed={song.want_to_learn}`, `Bookmark` icon and the text "Want to learn"; on click `onPatch(bookmarkPatch(song, !song.want_to_learn))`. Accent green when on.
  - SongRow: when `song.want_to_learn`, render `<Bookmark filled />` in accent green and a dashed-border "Want to learn" label (`border border-dashed border-accent text-accent rounded-full px-2 text-xs`) after the title, on phone and desktop.
  - FilterControls: a `<select aria-label="Filter by bookmark">` with "Any songs" (`''` → `null`), "Want to learn" (`true`), "Hide want to learn" (`false`), styled like the confidence select. FilterSummary chip labels: "Want to learn" / "Hiding want to learn".
  - Library: `const playable = useMemo(() => playableSongs(songs), [songs])`; pass `playable` to `MedleyView`, `ReviveView` and `AnalyticsView`; Analytics `onShow` becomes `setFilters({ ...EMPTY_FILTERS, bookmarked: false, ...patch })`. `SetsView` keeps the full `songs`.
  - SetsView `matches` (add-songs search): add `!s.want_to_learn` to the filter.
  - README "Sync across devices" step 2: run every file in `supabase/migrations/` in order; add a note that upgrading users run `0004_want_to_learn.sql` before deploying. Add `bookmark:` to any tag docs there.

- [ ] **Step 2: Run** `npm test && npm run build` — Expected: PASS.

- [ ] **Step 3: Verify in the browser** (`preview_start` with the dev server from `.claude/launch.json`, local mode):
  - Quick Add `Clair de lune bookmark:` → row shows the filled bookmark and "Want to learn".
  - Detail panel toggle off → label gone, confidence shows pp; toggle on again → label back, pp kept.
  - Revive, Medley (its key) and Analytics totals don't include it; an Analytics tile opens a library list whose count matches the tile.
  - Filter "Want to learn" shows only it; its chip clears it.
  - Add a song to a set, then bookmark it: the set still lists it; the add-songs search no longer offers it.
  - Phone width (375px): row label doesn't push the title off-screen.

- [ ] **Step 4: Commit** — `git commit -am "Show the want-to-learn bookmark and leave bookmarked songs out of playing views"`
