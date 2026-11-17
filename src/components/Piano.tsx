import type { CSSProperties } from 'react'
import { keyHue } from '../lib/songs'

const WHITE = [
  { pc: 0, name: 'C' },
  { pc: 2, name: 'D' },
  { pc: 4, name: 'E' },
  { pc: 5, name: 'F' },
  { pc: 7, name: 'G' },
  { pc: 9, name: 'A' },
  { pc: 11, name: 'B' },
]
/** Black keys, each sitting on the boundary after the nth white key. */
const BLACK = [
  { pc: 1, after: 1 },
  { pc: 3, after: 2 },
  { pc: 6, after: 4 },
  { pc: 8, after: 5 },
  { pc: 10, after: 6 },
]

export const hueStyle = (pc: number) => ({ '--kh': keyHue(pc) }) as CSSProperties

/**
 * One octave of piano keys used as a picker. With `counts`, each key also
 * shows how many songs it holds, as a number and a rising column of colour.
 */
export function Piano({
  label,
  selected,
  counts,
  describe,
  onPress,
}: {
  label: string
  selected: number | null
  counts?: number[]
  /** Accessible name for a key, e.g. "A, 4 songs". */
  describe: (pc: number) => string
  onPress: (pc: number) => void
}) {
  const max = Math.max(1, ...(counts ?? []))
  return (
    <div className="piano" role="group" aria-label={label}>
      {WHITE.map(({ pc, name }) => {
        const n = counts?.[pc] ?? 0
        return (
          <button key={pc} type="button" className="pkey" style={hueStyle(pc)} aria-pressed={selected === pc} aria-label={describe(pc)} onClick={() => onPress(pc)}>
            {n > 0 && <span className="pkey-fill" style={{ height: `${22 + (n / max) * 40}%` }} />}
            {n > 0 && <span className="pkey-count">{n}</span>}
            <span className="pkey-name">{name}</span>
          </button>
        )
      })}
      {BLACK.map(({ pc, after }) => {
        const n = counts?.[pc] ?? 0
        return (
          <button
            key={pc}
            type="button"
            className={`pkey-black ${n > 0 ? 'has-songs' : ''}`}
            style={{ ...hueStyle(pc), left: `calc(${(after / 7) * 100}% - 4.5%)` }}
            aria-pressed={selected === pc}
            aria-label={describe(pc)}
            onClick={() => onPress(pc)}
          >
            {n > 0 && n}
          </button>
        )
      })}
    </div>
  )
}
