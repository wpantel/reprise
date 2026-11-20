import { pitchClass, type Mode, type Song } from './songs'

type Keyed = Pick<Song, 'key_tonic' | 'key_mode'>

/** How far apart two keys feel: by key signature, steps around the circle of fifths. */
export type Distance = 'close' | 'moderate' | 'distant' | 'unknown'

export interface Transition {
  /** Spelled out for screen readers: "up a fourth", "relative minor", "no key"… */
  label: string
  /** The marking as written on the page, terse like a score: "↑ 4th", "↓ whole step · minor", "relative minor". */
  short: string
  /** Which way the tonic moves, by the shorter way round. */
  direction: 'up' | 'down' | 'none'
  distance: Distance
  /** Steps around the circle of fifths (0–6), plus a little for a change of mode. Used to order a set. */
  cost: number
}

/** Cost given to a change where either song has no key: middling, so those songs neither attract nor repel. */
const UNKNOWN_COST = 3
const MODE_CHANGE_COST = 0.5

/** Position of a key's signature on the circle of fifths (C/Am = 0, G/Em = 1, F/Dm = 11…). */
function signature(pc: number, mode: Mode) {
  const major = mode === 'minor' ? (pc + 3) % 12 : pc
  return (major * 7) % 12
}

const STEP_NAMES = ['', 'half step', 'whole step', 'minor third', 'major third', 'fourth', 'tritone']
const STEP_SHORT = ['', 'half step', 'whole step', 'min 3rd', 'maj 3rd', '4th', 'tritone']

/** Describes moving from one song's key to the next. */
export function transition(from: Keyed, to: Keyed): Transition {
  if (!from.key_tonic || !from.key_mode || !to.key_tonic || !to.key_mode) {
    return { label: 'no key', short: 'no key', direction: 'none', distance: 'unknown', cost: UNKNOWN_COST }
  }
  const a = pitchClass(from.key_tonic)
  const b = pitchClass(to.key_tonic)
  const modeChange = from.key_mode !== to.key_mode
  const around = Math.abs(signature(a, from.key_mode) - signature(b, to.key_mode))
  const fifths = Math.min(around, 12 - around)
  const cost = fifths + (modeChange ? MODE_CHANGE_COST : 0)
  const distance: Distance = fifths <= 1 ? 'close' : fifths <= 3 ? 'moderate' : 'distant'

  const toMode = to.key_mode
  const up = (b - a + 12) % 12
  const steps = up <= 6 ? up : 12 - up
  const direction = steps === 0 || steps === 6 ? 'none' : up <= 6 ? 'up' : 'down'
  let label: string
  let short: string
  if (a === b && !modeChange) label = short = 'same key'
  else if (fifths === 0) label = short = `relative ${toMode}`
  else if (a === b) label = short = `parallel ${toMode}`
  else {
    const motion = steps === 6 ? 'a tritone away' : `${direction} a ${STEP_NAMES[steps]}`
    label = modeChange ? `${motion}, into ${toMode}` : motion
    const arrow = direction === 'up' ? '↑ ' : direction === 'down' ? '↓ ' : ''
    short = `${arrow}${STEP_SHORT[steps]}${modeChange ? ` · ${toMode}` : ''}`
  }
  return { label, short, direction, distance, cost }
}

/** The changes between each song and the next. */
export const transitions = (songs: Keyed[]) => songs.slice(1).map((s, i) => transition(songs[i], s))

const totalCost = (order: number[], cost: number[][]) => order.slice(1).reduce((sum, j, i) => sum + cost[order[i]][j], 0)

/** Largest number of middle songs ordered exactly; longer sets use a quick search instead. */
const EXACT_LIMIT = 12

/**
 * Reorders a set so the key changes are as small as they can be, keeping the
 * opener and closer in place (they're usually chosen on purpose). When no order
 * is strictly better, the set stays as it is. Returns the indexes of `songs` in the new order.
 */
export function smoothOrder(songs: Keyed[]): number[] {
  const n = songs.length
  const original = songs.map((_, i) => i)
  if (n <= 3) return original
  const cost = songs.map((a) => songs.map((b) => transition(a, b).cost))
  const middle = original.slice(1, -1)
  const best = middle.length <= EXACT_LIMIT ? exactPath(middle, 0, n - 1, cost) : improvedPath(middle, 0, n - 1, cost)
  const candidate = [0, ...best, n - 1]
  // Only move songs when it actually helps.
  return totalCost(candidate, cost) < totalCost(original, cost) - 1e-9 ? candidate : original
}

/** Cheapest path from `start` through every one of `middle` to `end` (Held–Karp). */
function exactPath(middle: number[], start: number, end: number, cost: number[][]): number[] {
  const m = middle.length
  const full = (1 << m) - 1
  // best[mask][j]: cheapest cost from start through the songs in mask, ending at middle[j].
  const best: Float64Array[] = Array.from({ length: 1 << m }, () => new Float64Array(m).fill(Infinity))
  const prev: Int8Array[] = Array.from({ length: 1 << m }, () => new Int8Array(m).fill(-1))
  for (let j = 0; j < m; j++) best[1 << j][j] = cost[start][middle[j]]
  for (let mask = 1; mask <= full; mask++) {
    for (let j = 0; j < m; j++) {
      const here = best[mask][j]
      if (!(mask & (1 << j)) || here === Infinity) continue
      for (let k = 0; k < m; k++) {
        if (mask & (1 << k)) continue
        const next = mask | (1 << k)
        const c = here + cost[middle[j]][middle[k]]
        // Strictly better only, so earlier (original-order) choices win ties.
        if (c < best[next][k] - 1e-9) {
          best[next][k] = c
          prev[next][k] = j
        }
      }
    }
  }
  let last = 0
  for (let j = 1; j < m; j++) if (best[full][j] + cost[middle[j]][end] < best[full][last] + cost[middle[last]][end] - 1e-9) last = j
  const path: number[] = []
  for (let mask = full, j = last; j >= 0; ) {
    path.push(middle[j])
    const p = prev[mask][j]
    mask &= ~(1 << j)
    j = p
  }
  return path.reverse()
}

/** For long sets: nearest next key first, then reverse stretches while that shortens the total (2-opt). */
function improvedPath(middle: number[], start: number, end: number, cost: number[][]): number[] {
  const left = [...middle]
  const path: number[] = []
  let at = start
  while (left.length) {
    let pick = 0
    for (let i = 1; i < left.length; i++) if (cost[at][left[i]] < cost[at][left[pick]]) pick = i
    at = left.splice(pick, 1)[0]
    path.push(at)
  }
  const full = [start, ...path, end]
  for (let improved = true; improved; ) {
    improved = false
    for (let i = 1; i < full.length - 2; i++) {
      for (let j = i + 1; j < full.length - 1; j++) {
        // Costs are the same in both directions, so only the two ends of the stretch change.
        const before = cost[full[i - 1]][full[i]] + cost[full[j]][full[j + 1]]
        const after = cost[full[i - 1]][full[j]] + cost[full[i]][full[j + 1]]
        if (after < before - 1e-9) {
          full.splice(i, j - i + 1, ...full.slice(i, j + 1).reverse())
          improved = true
        }
      }
    }
  }
  return full.slice(1, -1)
}
