import { keyOrder, songKeyId, type Recall, type Song } from './songs'
import { fold } from './text'

export const NONE = 'none'

export interface Filters {
  q: string
  /** A key id like "A:major", or NONE for songs with no key. */
  key: string | null
  recall: Recall | typeof NONE | null
  confidence: number | typeof NONE | null
  /** A song must carry every tag listed. */
  tags: string[]
}
export const EMPTY_FILTERS: Filters = { q: '', key: null, recall: null, confidence: null, tags: [] }

export const hasActiveFilters = (f: Filters) =>
  f.q.trim() !== '' || f.key !== null || f.recall !== null || f.confidence !== null || f.tags.length > 0

export function matches(song: Song, f: Filters) {
  if (f.key !== null && (songKeyId(song) ?? NONE) !== f.key) return false
  if (f.recall !== null && (song.recall ?? NONE) !== f.recall) return false
  if (f.confidence !== null && (song.confidence ?? NONE) !== f.confidence) return false
  if (!f.tags.every((t) => song.tags.includes(t))) return false
  const words = fold(f.q).split(' ').filter(Boolean)
  if (words.length) {
    const haystack = fold(`${song.title} ${song.artist ?? ''}`)
    if (!words.every((w) => haystack.includes(w))) return false
  }
  return true
}

export type Sort = 'added' | 'title' | 'key'

export function sortSongs<T extends Song>(songs: T[], sort: Sort): T[] {
  const byTitle = (a: Song, b: Song) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base' })
  const copy = [...songs]
  if (sort === 'title') return copy.sort(byTitle)
  if (sort === 'key') {
    return copy.sort((a, b) => keyOrder(songKeyId(a)) - keyOrder(songKeyId(b)) || byTitle(a, b))
  }
  return copy.sort((a, b) => b.created_at.localeCompare(a.created_at))
}
