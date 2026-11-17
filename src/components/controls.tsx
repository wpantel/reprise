import {
  keyId,
  keyLabel,
  MAJOR_TONICS,
  MINOR_TONICS,
  parseKeyId,
  RECALLS,
  songKeyId,
  type Recall,
  type Song,
  type SongPatch,
} from '../lib/songs'

/** The key badge: filled for major, outlined for minor, dashed when unset. */
export function keyBadgeClass(song: Pick<Song, 'key_tonic' | 'key_mode'>) {
  const base = 'inline-flex h-7 items-center rounded-md px-2 text-sm font-semibold whitespace-nowrap'
  if (!song.key_tonic) return `${base} border border-dashed border-line font-normal text-ink-2`
  if (song.key_mode === 'major') return `${base} border border-transparent bg-accent-soft text-accent`
  return `${base} border border-accent text-accent`
}

export function KeyBadge({ song }: { song: Pick<Song, 'key_tonic' | 'key_mode'> }) {
  const id = songKeyId(song)
  return <span className={keyBadgeClass(song)}>{id ? keyLabel(id) : 'No key'}</span>
}

export function KeySelect({
  song,
  label,
  variant,
  disabled,
  onChange,
}: {
  song: Pick<Song, 'key_tonic' | 'key_mode'>
  label: string
  variant: 'badge' | 'field'
  disabled?: boolean
  onChange: (patch: SongPatch) => void
}) {
  return (
    <select
      aria-label={label}
      disabled={disabled}
      value={songKeyId(song) ?? ''}
      onChange={(e) => onChange(parseKeyId(e.target.value))}
      className={variant === 'badge' ? `${keyBadgeClass(song)} appearance-none hover:border-accent` : 'field'}
    >
      <option value="">{variant === 'badge' ? 'No key' : 'Not set'}</option>
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
  return (
    <select
      aria-label={label}
      disabled={disabled}
      value={value ?? ''}
      onChange={(e) => onChange({ recall: (e.target.value || null) as Recall | null })}
      className={
        variant === 'inline'
          ? `h-7 appearance-none rounded-md border border-transparent px-1.5 text-sm hover:border-line ${value ? '' : 'text-ink-2'}`
          : 'field'
      }
    >
      <option value="">{variant === 'inline' ? 'Not set' : 'Not set'}</option>
      {RECALLS.map((r) => (
        <option key={r.value} value={r.value}>
          {r.label}
        </option>
      ))}
    </select>
  )
}

/** Five dots. Selecting the current rating again clears it. */
export function ConfidenceDots({
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
  const hit = size === 'sm' ? 'h-7 w-5' : 'h-11 w-11'
  const dot = size === 'sm' ? 'h-2.5 w-2.5' : 'h-4 w-4'
  return (
    <div role="group" aria-label={`Confidence for ${title}: ${value ? `${value} of 5` : 'not set'}`} className="flex">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={disabled}
          aria-pressed={value === n}
          aria-label={value === n ? `Clear confidence (now ${n})` : `Set confidence to ${n}`}
          onClick={() => onChange({ confidence: value === n ? null : n })}
          className={`group flex items-center justify-center rounded-md ${hit}`}
        >
          <span
            className={`rounded-full border ${dot} ${
              value !== null && n <= value ? 'border-accent bg-accent' : 'border-ink-2 group-hover:border-accent'
            }`}
          />
        </button>
      ))}
    </div>
  )
}
