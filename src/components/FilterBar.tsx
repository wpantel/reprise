import type { Ref } from 'react'
import { EMPTY_FILTERS, hasActiveFilters, NONE, type Filters, type Sort } from '../lib/filters'
import { keyLabel, keyOrder, recallLabel, RECALLS, songKeyId, type Recall, type Song } from '../lib/songs'

const selectClass = 'field min-w-0 md:w-auto'

export function FilterBar({
  songs,
  filters,
  sort,
  shown,
  searchRef,
  onFilters,
  onSort,
}: {
  songs: Song[]
  filters: Filters
  sort: Sort
  shown: number
  searchRef: Ref<HTMLInputElement>
  onFilters: (f: Filters) => void
  onSort: (s: Sort) => void
}) {
  const set = (patch: Partial<Filters>) => onFilters({ ...filters, ...patch })

  const keyCounts = new Map<string, number>()
  let noKey = 0
  const tagSet = new Set<string>()
  for (const s of songs) {
    const id = songKeyId(s)
    if (id) keyCounts.set(id, (keyCounts.get(id) ?? 0) + 1)
    else noKey++
    s.tags.forEach((t) => tagSet.add(t))
  }
  const keys = [...keyCounts.keys()].sort((a, b) => keyOrder(a) - keyOrder(b))
  const tags = [...tagSet].sort().filter((t) => !filters.tags.includes(t))

  const chips: { label: string; clear: () => void }[] = []
  if (filters.q.trim()) chips.push({ label: `“${filters.q.trim()}”`, clear: () => set({ q: '' }) })
  if (filters.key) chips.push({ label: filters.key === NONE ? 'Missing key' : keyLabel(filters.key), clear: () => set({ key: null }) })
  if (filters.recall)
    chips.push({ label: filters.recall === NONE ? 'Recall not set' : recallLabel(filters.recall), clear: () => set({ recall: null }) })
  if (filters.confidence)
    chips.push({
      label: filters.confidence === NONE ? 'Confidence not set' : `Confidence ${filters.confidence}`,
      clear: () => set({ confidence: null }),
    })
  for (const t of filters.tags) chips.push({ label: `#${t}`, clear: () => set({ tags: filters.tags.filter((x) => x !== t) }) })

  const active = hasActiveFilters(filters)

  return (
    <section aria-label="Find songs" className="flex flex-col gap-2">
      <div className="grid grid-cols-2 gap-2 md:flex md:flex-wrap">
        <input
          ref={searchRef}
          type="search"
          className="field col-span-2 md:basis-56 md:flex-1"
          aria-label="Search by title or artist"
          aria-keyshortcuts="/"
          placeholder="Search title or artist"
          value={filters.q}
          onChange={(e) => set({ q: e.target.value })}
        />
        <select aria-label="Filter by key" className={selectClass} value={filters.key ?? ''} onChange={(e) => set({ key: e.target.value || null })}>
          <option value="">Any key</option>
          <option value={NONE}>Missing key ({noKey})</option>
          {keys.map((k) => (
            <option key={k} value={k}>
              {keyLabel(k)} ({keyCounts.get(k)})
            </option>
          ))}
        </select>
        <select
          aria-label="Filter by recall"
          className={selectClass}
          value={filters.recall ?? ''}
          onChange={(e) => set({ recall: (e.target.value || null) as Recall | typeof NONE | null })}
        >
          <option value="">Any recall</option>
          {RECALLS.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
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
              Confidence {n}
            </option>
          ))}
          <option value={NONE}>Not set</option>
        </select>
        {(tags.length > 0 || filters.tags.length > 0) && (
          <select
            aria-label="Filter by tag"
            className={selectClass}
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

      <div className="flex flex-wrap items-center gap-2">
        <p className="mr-auto text-sm text-ink-2" role="status">
          {active ? (
            <>
              <strong className="font-semibold text-ink">{shown}</strong> of {songs.length} songs
            </>
          ) : (
            <>
              <strong className="font-semibold text-ink">{songs.length}</strong> {songs.length === 1 ? 'song' : 'songs'}
            </>
          )}
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
                className="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-accent-soft pr-2.5 pl-3 text-sm font-medium text-accent md:min-h-7"
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
    </section>
  )
}
