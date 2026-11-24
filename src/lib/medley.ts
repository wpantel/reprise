import { pitchClass, type Mode, type Recall, type Song } from './songs'

export interface MedleyState {
  pc: number | null
  mode: Mode | null
  /** Memorized, by ear, or anything. */
  recall: Extract<Recall, 'memorized' | 'by_ear'> | null
  /** Song ids in shuffled order; null means alphabetical. */
  order: string[] | null
  /** Shortlisted song ids, in the order they were pinned. */
  pins: string[]
}
export const EMPTY_MEDLEY: MedleyState = { pc: null, mode: null, recall: null, order: null, pins: [] }

/** Songs in the chosen key, pinned first, then shuffled or alphabetical. */
export function medleySongs<T extends Song>(songs: T[], m: MedleyState): T[] {
  if (m.pc === null) return []
  const inKey = songs.filter(
    (s) => s.key_tonic && pitchClass(s.key_tonic) === m.pc && (!m.mode || s.key_mode === m.mode) && (!m.recall || s.recall === m.recall),
  )
  const rank = (s: Song) => {
    const i = m.order?.indexOf(s.id) ?? -1
    return i < 0 ? Number.MAX_SAFE_INTEGER : i
  }
  const pin = (s: Song) => {
    const i = m.pins.indexOf(s.id)
    return i < 0 ? Number.MAX_SAFE_INTEGER : i
  }
  return inKey.sort((a, b) => pin(a) - pin(b) || rank(a) - rank(b) || a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }))
}

export function shuffled<T>(items: T[], random: () => number = Math.random): T[] {
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

/** Moves the item at `from` to `to`, shifting the rest. */
export function moved<T>(items: T[], from: number, to: number): T[] {
  const out = [...items]
  const [item] = out.splice(from, 1)
  out.splice(Math.max(0, Math.min(out.length, to)), 0, item)
  return out
}

/** Songs that could stand in for `song` in a set: same key and mode, not already in the set. */
export function swapCandidates<T extends Song>(song: Song, songs: T[], inSet: string[]): T[] {
  if (!song.key_tonic) return []
  return songs
    .filter((s) => !s.want_to_learn && s.key_tonic && pitchClass(s.key_tonic) === pitchClass(song.key_tonic!) && s.key_mode === song.key_mode && !inSet.includes(s.id))
    .sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }))
}
