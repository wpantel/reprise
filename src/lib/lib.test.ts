import { describe, expect, it } from 'vitest'
import { detectArrangementType, normalizeUrl } from './arrangement'
import { flagDuplicates, parseBulk } from './bulk'
import { EMPTY_FILTERS, matches, NONE, sortSongs } from './filters'
import { keyLabel, parseKeyId, type Song } from './songs'

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
    expect([a, b, c].filter((s) => matches(s, { ...EMPTY_FILTERS, key: 'A:major' }))).toEqual([b])
    expect([a, b, c].filter((s) => matches(s, { ...EMPTY_FILTERS, key: NONE }))).toEqual([c])
  })
  it('combines key and recall', () => {
    expect(matches(b, { ...EMPTY_FILTERS, key: 'A:major', recall: 'by_ear' })).toBe(true)
    expect(matches(b, { ...EMPTY_FILTERS, key: 'A:major', recall: 'memorized' })).toBe(false)
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
