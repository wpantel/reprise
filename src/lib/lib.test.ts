import { describe, expect, it } from 'vitest'
import { detectArrangementType, normalizeUrl } from './arrangement'
import { flagDuplicates, parseBulk } from './bulk'
import { EMPTY_FILTERS, matches, NO_SCORE, NONE, sortSongs } from './filters'
import { agoLabel, analytics, recentlyPlayed, reviveGroups } from './history'
import { EMPTY_MEDLEY, medleySongs, moved, shuffled, swapCandidates } from './medley'
import { keyHue, keyLabel, parseKeyId, spellings, type Play, type Song } from './songs'

const song = (over: Partial<Song>): Song => ({
  id: over.title ?? 'x',
  title: 'Untitled',
  artist: null,
  key_tonic: null,
  key_mode: null,
  recall: null,
  confidence: null,
  arrangement_url: null,
  arrangement_type: null,
  tags: [],
  created_at: '2026-01-01T00:00:00Z',
  ...over,
})

describe('arrangement links', () => {
  it('adds a scheme and rejects non-web links', () => {
    expect(normalizeUrl('musescore.com/score/1')).toBe('https://musescore.com/score/1')
    expect(normalizeUrl('javascript:alert(1)')).toBeNull()
    expect(normalizeUrl('not a link')).toBeNull()
    expect(normalizeUrl('  ')).toBeNull()
  })
  it('suggests a type only when the URL makes it clear', () => {
    expect(detectArrangementType('https://musescore.com/user/1/scores/2')).toBe('musescore')
    expect(detectArrangementType('https://example.com/scores/Clair.PDF?dl=1')).toBe('pdf')
    expect(detectArrangementType('https://drive.google.com/file/d/abc')).toBeNull()
    expect(detectArrangementType('https://notmusescore.com/x')).toBeNull()
  })
})

describe('keys', () => {
  it('round-trips and labels', () => {
    expect(parseKeyId('F#:minor')).toEqual({ key_tonic: 'F#', key_mode: 'minor' })
    expect(parseKeyId('')).toEqual({ key_tonic: null, key_mode: null })
    expect(keyLabel('Bb:major')).toBe('B♭ major')
    expect(keyLabel('F#:minor')).toBe('F♯ minor')
  })
  it('spells black keys the common way first, per mode', () => {
    expect(spellings(1, 'major')).toEqual(['Db', 'C#'])
    expect(spellings(1, 'minor')).toEqual(['C#'])
    expect(spellings(8, 'minor')).toEqual(['G#', 'Ab'])
    expect(spellings(9, 'major')).toEqual(['A'])
  })
  it('gives all twelve keys distinct hues', () => {
    expect(new Set(Array.from({ length: 12 }, (_, pc) => keyHue(pc))).size).toBe(12)
  })
})

describe('bulk add', () => {
  it('parses one title per line, dropping blanks and list markers', () => {
    expect(parseBulk('Clair de Lune\n\n - River Flows in You\n3. Ob-La-Di\n', false)).toEqual([
      { title: 'Clair de Lune', artist: null },
      { title: 'River Flows in You', artist: null },
      { title: 'Ob-La-Di', artist: null },
    ])
  })
  it('splits "Title - Artist" only when asked', () => {
    expect(parseBulk('Yesterday - The Beatles', true)).toEqual([{ title: 'Yesterday', artist: 'The Beatles' }])
    expect(parseBulk('Yesterday - The Beatles', false)).toEqual([{ title: 'Yesterday - The Beatles', artist: null }])
  })
  it('flags likely duplicates, using the artist when both are known', () => {
    const existing = [song({ title: "Mia & Sebastian's Theme" }), song({ title: 'Hallelujah', artist: 'Leonard Cohen' })]
    const entries = [
      { title: 'mia and sebastian’s theme' },
      { title: 'Hallelujah', artist: 'Handel' },
      { title: 'Hallelujah' },
      { title: 'The Entertainer' },
      { title: 'Entertainer' },
    ]
    expect(flagDuplicates(entries, existing)).toEqual(['in_library', 'new', 'in_library', 'new', 'repeated'])
  })
})

describe('filters', () => {
  const a = song({ title: 'Clair de Lune', artist: 'Debussy', key_tonic: 'Db', key_mode: 'major', recall: 'with_score', tags: ['quiet'] })
  const b = song({ title: "Mia & Sebastian’s Theme", key_tonic: 'A', key_mode: 'major', recall: 'by_ear', confidence: 4, tags: ['movie', 'jazz'] })
  const c = song({ title: 'Für Elise' })

  it('filters by key, including missing key', () => {
    expect([a, b, c].filter((s) => matches(s, { ...EMPTY_FILTERS, pc: 9, mode: 'major' }))).toEqual([b])
    expect([a, b, c].filter((s) => matches(s, { ...EMPTY_FILTERS, pc: 9, mode: 'minor' }))).toEqual([])
    expect([a, b, c].filter((s) => matches(s, { ...EMPTY_FILTERS, pc: NONE }))).toEqual([c])
    expect([a, b, c].filter((s) => matches(s, { ...EMPTY_FILTERS, mode: 'major' }))).toEqual([a, b])
  })
  it('treats enharmonic spellings as the same piano key', () => {
    const cSharp = song({ title: 'x', key_tonic: 'C#', key_mode: 'major' })
    expect([a, cSharp].filter((s) => matches(s, { ...EMPTY_FILTERS, pc: 1 }))).toEqual([a, cSharp])
  })
  it('combines key and recall', () => {
    expect(matches(b, { ...EMPTY_FILTERS, pc: 9, mode: 'major', recall: 'by_ear' })).toBe(true)
    expect(matches(b, { ...EMPTY_FILTERS, pc: 9, mode: 'major', recall: 'memorized' })).toBe(false)
    expect(matches(c, { ...EMPTY_FILTERS, recall: NONE })).toBe(true)
  })
  it('filters by confidence and requires every tag', () => {
    expect(matches(b, { ...EMPTY_FILTERS, confidence: 4 })).toBe(true)
    expect(matches(a, { ...EMPTY_FILTERS, confidence: NONE })).toBe(true)
    expect(matches(b, { ...EMPTY_FILTERS, tags: ['movie', 'jazz'] })).toBe(true)
    expect(matches(b, { ...EMPTY_FILTERS, tags: ['movie', 'quiet'] })).toBe(false)
  })
  it('searches title and artist, ignoring accents and quote style', () => {
    expect(matches(c, { ...EMPTY_FILTERS, q: 'fur elise' })).toBe(true)
    expect(matches(b, { ...EMPTY_FILTERS, q: "sebastian's" })).toBe(true)
    expect(matches(a, { ...EMPTY_FILTERS, q: 'debussy clair' })).toBe(true)
    expect(matches(a, { ...EMPTY_FILTERS, q: 'chopin' })).toBe(false)
  })
  it('sorts by key in pitch order with missing keys last', () => {
    expect(sortSongs([c, a, b], 'key').map((s) => s.title)).toEqual([a.title, b.title, c.title])
  })
})

describe('play history', () => {
  const now = new Date('2026-11-17T12:00:00Z')
  const daysAgo = (n: number) => new Date(now.getTime() - n * 86_400_000).toISOString()
  const play = (song_id: string, n: number, felt_rusty = false): Play => ({ id: `${song_id}-${n}`, song_id, played_at: daysAgo(n), felt_rusty })

  const confident = song({ title: 'Confident', confidence: 5, recall: 'memorized', key_tonic: 'A', key_mode: 'minor' })
  const shaky = song({ title: 'Shaky', confidence: 2, recall: 'with_score', key_tonic: 'A', key_mode: 'minor' })
  const rusty = song({ title: 'Rusty', confidence: 2, recall: 'by_ear', key_tonic: 'C', key_mode: 'major' })
  const fresh = song({ title: 'Fresh', confidence: 5 })
  const never = song({ title: 'Never', confidence: 4 })
  const songs = [confident, shaky, rusty, fresh, never]
  const plays = [play('Confident', 90), play('Confident', 45), play('Shaky', 200), play('Rusty', 9, true), play('Fresh', 3)]

  it('revives confident songs after a month and rusty ones after a week', () => {
    const { due } = reviveGroups(songs, plays, now)
    expect(due.map((d) => [d.song.title, d.days])).toEqual([
      ['Confident', 45],
      ['Rusty', 9],
    ])
  })
  it('does not call a rusty song due once it has been played again', () => {
    const { due } = reviveGroups([rusty], [play('Rusty', 9, true), play('Rusty', 1)], now)
    expect(due).toEqual([])
  })
  it('keeps never-played songs in their own group', () => {
    const { due, unplayed } = reviveGroups(songs, plays, now)
    expect(unplayed.map((s) => s.title)).toEqual(['Never'])
    expect(due.some((d) => d.song.title === 'Never')).toBe(false)
    expect(reviveGroups(songs, [], now)).toMatchObject({ due: [] })
    expect(reviveGroups(songs, [], now).unplayed).toHaveLength(5)
  })
  it('summarises the library', () => {
    const a = analytics(songs, plays, now)
    expect(a).toMatchObject({ total: 5, withoutScore: 2, noKey: 2, playedRecently: 2 })
    expect(a.byRecall).toEqual({ memorized: 1, with_score: 1, by_ear: 1, none: 2 })
    expect(a.byKey).toEqual([
      { id: 'C:major', count: 1 },
      { id: 'A:minor', count: 2 },
    ])
  })
  it('filters by played recently and by playable without a score', () => {
    const recent = recentlyPlayed(plays, now)
    expect(songs.filter((s) => matches(s, { ...EMPTY_FILTERS, played: 'recent' }, recent)).map((s) => s.title)).toEqual(['Rusty', 'Fresh'])
    expect(songs.filter((s) => matches(s, { ...EMPTY_FILTERS, played: 'stale' }, recent)).map((s) => s.title)).toEqual(['Confident', 'Shaky', 'Never'])
    expect(songs.filter((s) => matches(s, { ...EMPTY_FILTERS, recall: NO_SCORE })).map((s) => s.title)).toEqual(['Confident', 'Rusty'])
  })
  it('words elapsed time plainly', () => {
    expect([0, 1, 9, 21, 95].map(agoLabel)).toEqual(['today', 'yesterday', '9 days ago', '3 weeks ago', '3 months ago'])
  })
})

describe('medley and sets', () => {
  const aMaj1 = song({ title: 'Alpha', key_tonic: 'A', key_mode: 'major', recall: 'memorized' })
  const aMaj2 = song({ title: 'Bravo', key_tonic: 'A', key_mode: 'major', recall: 'by_ear' })
  const aMaj3 = song({ title: 'Charlie', key_tonic: 'A', key_mode: 'major', recall: 'with_score' })
  const aMin = song({ title: 'Delta', key_tonic: 'A', key_mode: 'minor', recall: 'memorized' })
  const dMaj = song({ title: 'Echo', key_tonic: 'D', key_mode: 'major' })
  const all = [dMaj, aMin, aMaj3, aMaj2, aMaj1]
  const titles = (list: Song[]) => list.map((s) => s.title)

  it('lists nothing until a key is picked', () => {
    expect(medleySongs(all, EMPTY_MEDLEY)).toEqual([])
  })
  it('lists songs in the key, alphabetically, narrowed by mode and recall', () => {
    expect(titles(medleySongs(all, { ...EMPTY_MEDLEY, pc: 9 }))).toEqual(['Alpha', 'Bravo', 'Charlie', 'Delta'])
    expect(titles(medleySongs(all, { ...EMPTY_MEDLEY, pc: 9, mode: 'major' }))).toEqual(['Alpha', 'Bravo', 'Charlie'])
    expect(titles(medleySongs(all, { ...EMPTY_MEDLEY, pc: 9, recall: 'memorized' }))).toEqual(['Alpha', 'Delta'])
  })
  it('puts pinned songs first, then follows the shuffle', () => {
    const m = { ...EMPTY_MEDLEY, pc: 9, mode: 'major' as const, order: ['Charlie', 'Bravo', 'Alpha'], pins: ['Alpha'] }
    expect(titles(medleySongs(all, m))).toEqual(['Alpha', 'Charlie', 'Bravo'])
  })
  it('shuffles without losing songs', () => {
    expect(shuffled([1, 2, 3, 4], () => 0).sort()).toEqual([1, 2, 3, 4])
    expect(shuffled([1, 2, 3, 4], () => 0)).not.toEqual([1, 2, 3, 4])
  })
  it('reorders a set', () => {
    expect(moved(['a', 'b', 'c', 'd'], 0, 2)).toEqual(['b', 'c', 'a', 'd'])
    expect(moved(['a', 'b', 'c', 'd'], 3, 0)).toEqual(['d', 'a', 'b', 'c'])
    expect(moved(['a', 'b'], 0, 9)).toEqual(['b', 'a'])
  })
  it('offers swaps in the same key and mode that are not already in the set', () => {
    expect(titles(swapCandidates(aMaj1, all, ['Alpha', 'Bravo']))).toEqual(['Charlie'])
    expect(swapCandidates(song({ title: 'No key' }), all, [])).toEqual([])
  })
})
