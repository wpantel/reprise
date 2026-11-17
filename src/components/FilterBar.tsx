import { useState, type Ref } from 'react'
import { EMPTY_FILTERS, hasActiveFilters, NO_SCORE, NONE, type Filters, type Sort } from '../lib/filters'
import { DYNAMICS, PITCH_NAMES, pitchClass, recallLabel, RECALLS, type Mode, type Song } from '../lib/songs'
import { playKey, setSoundOn, soundOn } from '../lib/sound'
import { hueStyle, Piano } from './Piano'

type FilterProps = { songs: Song[]; filters: Filters; onFilters: (f: Filters) => void }

/** Search plus the recall, confidence and tag menus. */
export function FilterControls({ songs, filters, searchRef, onFilters }: FilterProps & { searchRef: Ref<HTMLInputElement> }) {
  const set = (patch: Partial<Filters>) => onFilters({ ...filters, ...patch })
  const tags = [...new Set(songs.flatMap((s) => s.tags))].sort().filter((t) => !filters.tags.includes(t))
  const selectClass = 'field min-w-0 md:w-auto md:flex-1'

  return (
    <div className="grid grid-cols-2 gap-2 md:flex md:flex-wrap">
      <input
        ref={searchRef}
        type="search"
        className="field col-span-2 md:basis-full"
        aria-label="Search by title or artist"
        aria-keyshortcuts="/"
        placeholder="Search title or artist"
        value={filters.q}
        onChange={(e) => set({ q: e.target.value })}
      />
      <select
        aria-label="Filter by recall"
        className={selectClass}
        value={filters.recall ?? ''}
        onChange={(e) => set({ recall: (e.target.value || null) as Filters['recall'] })}
      >
        <option value="">Any recall</option>
        {RECALLS.map((r) => (
          <option key={r.value} value={r.value}>
            {r.label}
          </option>
        ))}
        <option value={NO_SCORE}>Without a score</option>
        <option value={NONE}>Not set</option>
      </select>
      <select
        aria-label="Filter by confidence"
        className={selectClass}
        value={filters.confidence ?? ''}
        onChange={(e) => set({ confidence: e.target.value === NONE ? NONE : e.target.value ? Number(e.target.value) : null })}
      >
        <option value="">Any confidence</option>
        {[5, 4, 3, 2, 1].map((n) => (
          <option key={n} value={n}>
            {n} · {DYNAMICS[n - 1]}
          </option>
        ))}
        <option value={NONE}>Not set</option>
      </select>
      {(tags.length > 0 || filters.tags.length > 0) && (
        <select
          aria-label="Filter by tag"
          className={`${selectClass} col-span-2`}
          value=""
          disabled={tags.length === 0}
          onChange={(e) => e.target.value && set({ tags: [...filters.tags, e.target.value] })}
        >
          <option value="">{filters.tags.length ? 'Add tag' : 'Any tag'}</option>
          {tags.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      )}
    </div>
  )
}

const MODES: { value: Mode | null; label: string }[] = [
  { value: null, label: 'All' },
  { value: 'major', label: 'Major' },
  { value: 'minor', label: 'Minor' },
]

/** The keyboard: shows how many songs sit in each key, and filters to a key when pressed. */
export function KeyFilter({ songs, filters, onFilters }: FilterProps) {
  const [sound, setSound] = useState(soundOn)
  const counts = Array<number>(12).fill(0)
  let noKey = 0
  for (const s of songs) {
    if (!s.key_tonic) noKey++
    else if (!filters.mode || s.key_mode === filters.mode) counts[pitchClass(s.key_tonic)]++
  }
  const selected = typeof filters.pc === 'number' ? filters.pc : null

  return (
    <section aria-label="Filter by key" className="flex flex-col gap-3 rounded-2xl border border-line bg-card p-3 shadow-card">
      <div className="flex items-center gap-2">
        <h2 className="mr-auto font-display text-2xl leading-none">Keys</h2>
        <div className="seg" role="group" aria-label="Major or minor">
          {MODES.map((m) => (
            <button
              key={m.label}
              type="button"
              aria-pressed={filters.mode === m.value}
              onClick={() => onFilters({ ...filters, mode: m.value, pc: m.value && filters.pc === NONE ? null : filters.pc })}
            >
              {m.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          aria-pressed={sound}
          aria-label="Play a sound when a key is pressed"
          title={sound ? 'Key sounds on' : 'Key sounds off'}
          onClick={() => {
            setSoundOn(!sound)
            setSound(!sound)
          }}
          className={`flex h-10 w-10 items-center justify-center rounded-lg md:h-8 md:w-8 ${sound ? 'bg-accent-soft text-accent' : 'text-ink-2 hover:bg-surface'}`}
        >
          <svg aria-hidden="true" viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2.5 6v4h2.5l3.5 3V3L5 6z" />
            {sound ? <path d="M11 5.5a3.5 3.5 0 0 1 0 5M12.8 3.5a6 6 0 0 1 0 9" /> : <path d="m11 6 3.5 4M14.5 6 11 10" />}
          </svg>
        </button>
      </div>

      <Piano
        label="Piano keys. Press one to show songs in that key."
        selected={selected}
        counts={counts}
        describe={(pc) => `${PITCH_NAMES[pc]}, ${counts[pc]} ${counts[pc] === 1 ? 'song' : 'songs'}`}
        onPress={(pc) => {
          const next = selected === pc ? null : pc
          onFilters({ ...filters, pc: next })
          if (next !== null) playKey(pc, filters.mode)
        }}
      />

      <button
        type="button"
        aria-pressed={filters.pc === NONE}
        onClick={() => onFilters({ ...filters, pc: filters.pc === NONE ? null : NONE, mode: null })}
        className={`keybadge keybadge-none self-start ${filters.pc === NONE ? 'bg-surface font-medium text-ink' : ''}`}
      >
        Missing key · {noKey}
      </button>
    </section>
  )
}

/** Result count, sort, and the active filters as removable chips. */
export function FilterSummary({
  songs,
  filters,
  sort,
  shown,
  onFilters,
  onSort,
}: FilterProps & { sort: Sort; shown: number; onSort: (s: Sort) => void }) {
  const set = (patch: Partial<Filters>) => onFilters({ ...filters, ...patch })

  const chips: { label: string; pc?: number; clear: () => void }[] = []
  if (filters.q.trim()) chips.push({ label: `“${filters.q.trim()}”`, clear: () => set({ q: '' }) })
  if (filters.pc === NONE) chips.push({ label: 'Missing key', clear: () => set({ pc: null }) })
  else if (filters.pc !== null)
    chips.push({
      label: `${PITCH_NAMES[filters.pc]}${filters.mode ? ` ${filters.mode}` : ''}`,
      pc: filters.pc,
      clear: () => set({ pc: null, mode: null }),
    })
  else if (filters.mode) chips.push({ label: `Any ${filters.mode} key`, clear: () => set({ mode: null }) })
  if (filters.recall)
    chips.push({
      label: filters.recall === NONE ? 'Recall not set' : filters.recall === NO_SCORE ? 'Without a score' : recallLabel(filters.recall),
      clear: () => set({ recall: null }),
    })
  if (filters.confidence)
    chips.push({
      label: filters.confidence === NONE ? 'Confidence not set' : `Confidence ${filters.confidence} (${DYNAMICS[filters.confidence - 1]})`,
      clear: () => set({ confidence: null }),
    })
  if (filters.played)
    chips.push({ label: filters.played === 'recent' ? 'Played in the last 30 days' : 'Not played in 30 days', clear: () => set({ played: null }) })
  for (const t of filters.tags) chips.push({ label: `#${t}`, clear: () => set({ tags: filters.tags.filter((x) => x !== t) }) })

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <p className="mr-auto text-ink-2" role="status">
          <strong className="font-display text-3xl leading-none font-normal text-ink">{hasActiveFilters(filters) ? shown : songs.length}</strong>{' '}
          {hasActiveFilters(filters) ? `of ${songs.length} songs` : songs.length === 1 ? 'song' : 'songs'}
        </p>
        <label className="flex items-center gap-1.5 text-sm text-ink-2">
          Sort
          <select className="field w-auto" value={sort} onChange={(e) => onSort(e.target.value as Sort)}>
            <option value="added">Recently added</option>
            <option value="title">Title</option>
            <option value="key">Key</option>
          </select>
        </label>
      </div>

      {chips.length > 0 && (
        <ul aria-label="Active filters" className="flex flex-wrap items-center gap-2">
          {chips.map((c) => (
            <li key={c.label}>
              <button
                onClick={c.clear}
                aria-label={`Remove filter: ${c.label}`}
                style={c.pc !== undefined ? { ...hueStyle(c.pc), background: 'var(--key-tint)', color: 'var(--key-ink)' } : undefined}
                className={`inline-flex min-h-9 items-center gap-1.5 rounded-full bg-accent-soft pr-2.5 pl-3 text-sm font-medium text-accent md:min-h-7 ${c.pc !== undefined ? 'hue' : ''}`}
              >
                {c.label}
                <span aria-hidden="true">×</span>
              </button>
            </li>
          ))}
          {chips.length > 1 && (
            <li>
              <button className="min-h-9 px-1 text-sm text-ink-2 underline md:min-h-7" onClick={() => onFilters(EMPTY_FILTERS)}>
                Clear all
              </button>
            </li>
          )}
        </ul>
      )}
    </div>
  )
}
