import {
  DYNAMICS,
  keyId,
  keyLabel,
  MAJOR_TONICS,
  MINOR_TONICS,
  parseKeyId,
  pitchClass,
  RECALLS,
  recallLabel,
  songKeyId,
  type Recall,
  type Song,
  type SongPatch,
} from '../lib/songs'
import { hueStyle } from './Piano'

type Keyed = Pick<Song, 'key_tonic' | 'key_mode'>

/** Colour comes from the tonic; the shape (filled or outlined) from the mode. */
function badgeProps(song: Keyed) {
  if (!song.key_tonic) return { className: 'keybadge keybadge-none' }
  return { className: `keybadge keybadge-${song.key_mode}`, style: hueStyle(pitchClass(song.key_tonic)) }
}

export function KeyBadge({ song }: { song: Keyed }) {
  const id = songKeyId(song)
  return <span {...badgeProps(song)}>{id ? keyLabel(id) : 'No key'}</span>
}

/** The key badge as an in-place picker (desktop rows). */
export function KeySelect({
  song,
  label,
  disabled,
  onChange,
}: {
  song: Keyed
  label: string
  disabled?: boolean
  onChange: (patch: SongPatch) => void
}) {
  const badge = badgeProps(song)
  return (
    <select
      aria-label={label}
      disabled={disabled}
      value={songKeyId(song) ?? ''}
      onChange={(e) => onChange(parseKeyId(e.target.value))}
      className={`${badge.className} appearance-none`}
      style={badge.style}
    >
      <option value="">No key</option>
      <optgroup label="Major">
        {MAJOR_TONICS.map((t) => (
          <option key={t} value={keyId(t, 'major')}>
            {keyLabel(keyId(t, 'major'))}
          </option>
        ))}
      </optgroup>
      <optgroup label="Minor">
        {MINOR_TONICS.map((t) => (
          <option key={t} value={keyId(t, 'minor')}>
            {keyLabel(keyId(t, 'minor'))}
          </option>
        ))}
      </optgroup>
    </select>
  )
}

const RECALL_ICON: Record<Recall, { path: string; className: string }> = {
  // By heart.
  memorized: { path: 'M8 13.5S2.5 10 2.5 6.2A3 3 0 0 1 8 4.6a3 3 0 0 1 5.5 1.6C13.5 10 8 13.5 8 13.5Z', className: 'text-felt' },
  // A page of music.
  with_score: { path: 'M4 2.5h8v11H4zM6 5.5h4M6 8h4M6 10.5h4', className: 'text-accent' },
  // Sound.
  by_ear: { path: 'M3 6.5v3M6 4v8M9 2.5v11M12 5.5v5', className: 'text-brass' },
}

export function RecallIcon({ recall }: { recall: Recall }) {
  const icon = RECALL_ICON[recall]
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" className={`h-4 w-4 shrink-0 ${icon.className}`} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d={icon.path} />
    </svg>
  )
}

export function RecallTag({ recall }: { recall: Recall }) {
  return (
    <span className="inline-flex items-center gap-1 text-xs text-ink-2">
      <RecallIcon recall={recall} />
      {recallLabel(recall)}
    </span>
  )
}

export function RecallSelect({
  value,
  label,
  variant,
  disabled,
  onChange,
}: {
  value: Recall | null
  label: string
  variant: 'inline' | 'field'
  disabled?: boolean
  onChange: (patch: SongPatch) => void
}) {
  const select = (
    <select
      aria-label={label}
      disabled={disabled}
      value={value ?? ''}
      onChange={(e) => onChange({ recall: (e.target.value || null) as Recall | null })}
      className={
        variant === 'inline'
          ? `h-7 min-w-0 appearance-none rounded-md border border-transparent px-1 text-sm hover:border-line ${value ? '' : 'text-ink-2'}`
          : 'field'
      }
    >
      <option value="">Not set</option>
      {RECALLS.map((r) => (
        <option key={r.value} value={r.value}>
          {r.label}
        </option>
      ))}
    </select>
  )
  if (variant === 'field') return select
  return (
    <span className="flex items-center gap-0.5">
      {value ? <RecallIcon recall={value} /> : <span className="w-4" />}
      {select}
    </span>
  )
}

/** Confidence as dynamics, pp to ff. Choosing the current marking again clears it. */
export function Dynamics({
  value,
  title,
  size,
  disabled,
  onChange,
}: {
  value: number | null
  title: string
  size: 'sm' | 'lg'
  disabled?: boolean
  onChange: (patch: SongPatch) => void
}) {
  const shape = size === 'sm' ? 'h-7 w-6 text-[1.0625rem]' : 'h-11 w-11 text-2xl'
  return (
    <div role="group" aria-label={`Confidence for ${title}: ${value ? `${value} of 5` : 'not set'}`} className="dyn">
      {DYNAMICS.map((mark, i) => {
        const n = i + 1
        return (
          <button
            key={n}
            type="button"
            disabled={disabled}
            aria-pressed={value === n}
            aria-label={value === n ? `Clear confidence (now ${n} of 5, ${mark})` : `Set confidence to ${n} of 5 (${mark})`}
            onClick={() => onChange({ confidence: value === n ? null : n })}
            className={shape}
          >
            {mark}
          </button>
        )
      })}
    </div>
  )
}

/** The repeat sign that gives Reprise its name. */
export function Logo({ className = 'h-9 w-auto' }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 26 36" className={className}>
      <circle cx="4" cy="13" r="3.2" fill="var(--felt)" />
      <circle cx="4" cy="23" r="3.2" fill="var(--klein)" />
      <rect x="12" y="2" width="2" height="32" fill="var(--ebony)" />
      <rect x="18" y="2" width="7" height="32" rx="1" fill="var(--ebony)" />
    </svg>
  )
}

/** One tap to record a play today; tapping again on the same day undoes it. */
export function PlayedButton({
  title,
  playedToday,
  lastPlayed,
  disabled,
  onToggle,
}: {
  title: string
  playedToday: boolean
  /** e.g. "3 weeks ago", or null if never played. */
  lastPlayed: string | null
  disabled?: boolean
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      aria-pressed={playedToday}
      aria-label={playedToday ? `${title}: played today. Undo` : `Mark ${title} as played today`}
      title={lastPlayed ? `Last played ${lastPlayed}` : 'Not played yet'}
      onClick={onToggle}
      className="group flex h-11 w-11 items-center justify-center md:h-8 md:w-8"
    >
      <span
        className={`flex h-7 w-7 items-center justify-center rounded-full border ${
          playedToday ? 'border-accent bg-accent text-accent-ink' : 'border-line text-ink-2 group-hover:border-accent group-hover:text-accent'
        }`}
      >
        <svg aria-hidden="true" viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="m3.5 8.5 3 3 6-7" />
        </svg>
      </span>
    </button>
  )
}
