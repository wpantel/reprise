import { keyOrder, songKeyId, type Play, type Recall, type Song } from './songs'

const DAY = 86_400_000

/** Confident songs come back after this many days without a play. */
export const REVIVE_AFTER_DAYS = 30
/** Songs that felt rusty last time come back sooner. */
export const RUSTY_AFTER_DAYS = 7
/** "Confident" means a rating of f or ff. */
export const CONFIDENT_FROM = 4
/** Window for "played recently" in analytics. */
export const RECENT_DAYS = 30

export const daysSince = (iso: string, now: Date) => Math.max(0, Math.floor((now.getTime() - new Date(iso).getTime()) / DAY))
export const isSameDay = (iso: string, now: Date) => new Date(iso).toDateString() === now.toDateString()

/** The most recent play of each song. */
export function lastPlays(plays: Play[]): Map<string, Play> {
  const last = new Map<string, Play>()
  for (const p of plays) {
    const cur = last.get(p.song_id)
    if (!cur || p.played_at > cur.played_at) last.set(p.song_id, p)
  }
  return last
}

export function agoLabel(days: number) {
  if (days === 0) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 14) return `${days} days ago`
  if (days < 60) return `${Math.floor(days / 7)} weeks ago`
  return `${Math.floor(days / 30)} months ago`
}

export interface DueSong<T extends Song> {
  song: T
  last: Play
  days: number
  /** Days past the point it came due; larger means more overdue. */
  overdue: number
}

/**
 * Splits the library for the Revive view.
 * - due: played before, and either felt rusty a week or more ago, or confident and
 *   not played for a month or more. Most overdue first.
 * - unplayed: never marked as played. Kept apart so a fresh import doesn't look forgotten.
 */
export function reviveGroups<T extends Song>(songs: T[], plays: Play[], now: Date): { due: DueSong<T>[]; unplayed: T[] } {
  const last = lastPlays(plays)
  const due: DueSong<T>[] = []
  const unplayed: T[] = []
  for (const song of songs) {
    const play = last.get(song.id)
    if (!play) {
      unplayed.push(song)
      continue
    }
    const days = daysSince(play.played_at, now)
    const limit = play.felt_rusty ? RUSTY_AFTER_DAYS : (song.confidence ?? 0) >= CONFIDENT_FROM ? REVIVE_AFTER_DAYS : null
    if (limit !== null && days >= limit) due.push({ song, last: play, days, overdue: days - limit })
  }
  due.sort((a, b) => b.overdue - a.overdue || a.song.title.localeCompare(b.song.title))
  unplayed.sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0) || a.title.localeCompare(b.title))
  return { due, unplayed }
}

/** Ids of songs played within the last `RECENT_DAYS` days. */
export function recentlyPlayed(plays: Play[], now: Date): Set<string> {
  return new Set(plays.filter((p) => daysSince(p.played_at, now) < RECENT_DAYS).map((p) => p.song_id))
}

export interface Analytics {
  total: number
  /** Memorized or by ear. */
  withoutScore: number
  byRecall: Record<Recall | 'none', number>
  /** Keys that have songs, in pitch order, major before minor. */
  byKey: { id: string; count: number }[]
  noKey: number
  playedRecently: number
}

export function analytics(songs: Song[], plays: Play[], now: Date): Analytics {
  const recent = recentlyPlayed(plays, now)
  const byRecall: Analytics['byRecall'] = { memorized: 0, with_score: 0, by_ear: 0, none: 0 }
  const keys = new Map<string, number>()
  let noKey = 0
  let playedRecently = 0
  for (const s of songs) {
    byRecall[s.recall ?? 'none']++
    const id = songKeyId(s)
    if (id) keys.set(id, (keys.get(id) ?? 0) + 1)
    else noKey++
    if (recent.has(s.id)) playedRecently++
  }
  return {
    total: songs.length,
    withoutScore: byRecall.memorized + byRecall.by_ear,
    byRecall,
    byKey: [...keys].map(([id, count]) => ({ id, count })).sort((a, b) => keyOrder(a.id) - keyOrder(b.id)),
    noKey,
    playedRecently,
  }
}

