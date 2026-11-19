import { describe, expect, it } from 'vitest'
import { detectArrangementType, normalizeUrl } from './arrangement'
import { flagDuplicates, parseBulk } from './bulk'
import { EMPTY_FILTERS, matches, NO_SCORE, NONE, sortSongs } from './filters'
import { agoLabel, analytics, daysSince, recentlyPlayed, reviveGroups } from './history'
import { EMPTY_MEDLEY, medleySongs, moved, shuffled, swapCandidates } from './medley'
import { parseConfidence, parseKey, parseTags } from './tags'
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
  it('counts calendar days in local time, not 24-hour blocks', () => {
    const at = (d: number, h: number) => new Date(2026, 10, d, h).toISOString()
    const morning = new Date(2026, 10, 18, 9)
    expect(daysSince(at(17, 23), morning)).toBe(1)
    expect(daysSince(at(18, 0), morning)).toBe(0)
    expect(daysSince(at(10, 23), new Date(2026, 10, 18, 0, 30))).toBe(8)
    // Across the November daylight-saving change.
    expect(daysSince(new Date(2026, 10, 1, 1).toISOString(), new Date(2026, 10, 2, 0, 30))).toBe(1)
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

describe('tags in typed titles', () => {
  it('splits artist: off the title, with or without a space before it', () => {
    expect(parseTags('somesongnameXXX No. 3 artist: Franz Liszt')).toEqual({ title: 'somesongnameXXX No. 3', artist: 'Franz Liszt' })
    expect(parseTags('Clair de Lune ARTIST:Debussy')).toEqual({ title: 'Clair de Lune', artist: 'Debussy' })
    expect(parseTags('somesongnameXXX No. 3artist: Franz Liszt')).toEqual({ title: 'somesongnameXXX No. 3', artist: 'Franz Liszt' })
  })
  it('reads key and confidence tags in any order', () => {
    const want = { title: 'Liebestraum No. 3', artist: 'Franz Liszt', key_tonic: 'Ab', key_mode: 'major', confidence: 3 }
    expect(parseTags('Liebestraum No. 3 artist: Franz Liszt key: A flat major confidence: mf')).toEqual(want)
    expect(parseTags('Liebestraum No. 3 confidence: MF key: Ab major artist: Franz Liszt')).toEqual(want)
    expect(parseTags('Liebestraum No. 3, key: A flat major, artist: Franz Liszt, confidence: mf')).toEqual(want)
    expect(parseTags('Gymnopédie No. 1 key: D major')).toEqual({ title: 'Gymnopédie No. 1', artist: null, key_tonic: 'D', key_mode: 'major' })
    expect(parseTags('Prelude confidence: pp')).toEqual({ title: 'Prelude', artist: null, confidence: 1 })
  })
  it('leaves tags it can’t read in the title', () => {
    expect(parseTags('Liebestraum No. 3')).toEqual({ title: 'Liebestraum No. 3', artist: null })
    expect(parseTags('Song artist:')).toEqual({ title: 'Song artist:', artist: null })
    expect(parseTags('artist: Liszt')).toEqual({ title: 'artist: Liszt', artist: null })
    expect(parseTags('Song key: H major artist: X')).toEqual({ title: 'Song key: H major', artist: 'X' })
    expect(parseTags('Song confidence: mp')).toEqual({ title: 'Song confidence: mp', artist: null })
    expect(parseTags('Whiskey: A Love Story')).toEqual({ title: 'Whiskey: A Love Story', artist: null })
  })
  it('reads keys written many ways', () => {
    expect(parseKey('A major')).toEqual({ key_tonic: 'A', key_mode: 'major' })
    expect(parseKey('a flat major')).toEqual({ key_tonic: 'Ab', key_mode: 'major' })
    expect(parseKey('B-flat minor')).toEqual({ key_tonic: 'Bb', key_mode: 'minor' })
    expect(parseKey('F♯ min')).toEqual({ key_tonic: 'F#', key_mode: 'minor' })
    expect(parseKey('c#m')).toEqual({ key_tonic: 'C#', key_mode: 'minor' })
    expect(parseKey('Eb')).toEqual({ key_tonic: 'Eb', key_mode: 'major' })
    expect(parseKey('A# major')).toEqual({ key_tonic: 'Bb', key_mode: 'major' })
    expect(parseKey('Cb major')).toEqual({ key_tonic: 'B', key_mode: 'major' })
    expect(parseKey('H major')).toBeNull()
    expect(parseKey('A Love Story')).toBeNull()
  })
  it('reads confidence only as pp, p, mf, f or ff', () => {
    expect(['pp', 'P', 'mf', 'F', 'FF'].map(parseConfidence)).toEqual([1, 2, 3, 4, 5])
    expect(['mp', 'fff', '3', ''].map(parseConfidence)).toEqual([null, null, null, null])
  })
  it('works in bulk add, alongside "Title - Artist"', () => {
    expect(parseBulk('Nocturne artist: Chopin', false)).toEqual([{ title: 'Nocturne', artist: 'Chopin' }])
    expect(parseBulk('Nocturne - Chopin key: C# minor', true)).toEqual([
      { title: 'Nocturne', artist: 'Chopin', key_tonic: 'C#', key_mode: 'minor' },
    ])
  })
})
