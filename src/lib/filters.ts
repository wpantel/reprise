import { keyOrder, pitchClass, songKeyId, type Mode, type Recall, type Song } from './songs'
import { fold } from './text'

export const NONE = 'none'
/** Recall filter value for "memorized or by ear". */
export const NO_SCORE = 'no_score'

export interface Filters {
  q: string
  /** A piano key (0 = C … 11 = B, either spelling), or NONE for songs with no key. */
  pc: number | typeof NONE | null
  mode: Mode | null
  recall: Recall | typeof NONE | typeof NO_SCORE | null
  confidence: number | typeof NONE | null
  /** A song must carry every tag listed. */
  tags: string[]
  /** Played in the last 30 days ('recent') or not ('stale'). */
  played: 'recent' | 'stale' | null
  /** Only songs bookmarked to learn (true), only the rest (false), or both (null). */
  bookmarked: boolean | null
}
export const EMPTY_FILTERS: Filters = { q: '', pc: null, mode: null, recall: null, confidence: null, tags: [], played: null, bookmarked: null }

export const hasActiveFilters = (f: Filters) =>
  f.q.trim() !== '' || f.pc !== null || f.mode !== null || f.recall !== null || f.confidence !== null || f.tags.length > 0 || f.played !== null || f.bookmarked !== null

export function matches(song: Song, f: Filters, recent?: Set<string>) {
  if (f.played !== null && (recent?.has(song.id) ?? false) !== (f.played === 'recent')) return false
  if (f.bookmarked !== null && song.want_to_learn !== f.bookmarked) return false
  if (f.pc === NONE && song.key_tonic) return false
  if (typeof f.pc === 'number' && (!song.key_tonic || pitchClass(song.key_tonic) !== f.pc)) return false
  if (f.mode !== null && song.key_mode !== f.mode) return false
  if (f.recall === NO_SCORE) {
    if (song.recall !== 'memorized' && song.recall !== 'by_ear') return false
  } else if (f.recall !== null && (song.recall ?? NONE) !== f.recall) return false
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
