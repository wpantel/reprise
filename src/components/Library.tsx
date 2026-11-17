import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { EMPTY_FILTERS, hasActiveFilters, matches, sortSongs, type Filters, type Sort } from '../lib/filters'
import type { SongStore } from '../lib/store'
import { useSongs } from '../lib/useSongs'
import { BulkAdd } from './BulkAdd'
import { Logo } from './controls'
import { FilterControls, FilterSummary, KeyFilter } from './FilterBar'
import { hueStyle } from './Piano'
import { QuickAdd } from './QuickAdd'
import { SongDetail } from './SongDetail'
import { ROW_GRID, SongRow } from './SongRow'

const SORT_KEY = 'repertoire.sort'
/** Pitch classes in circle-of-fifths order: C, G, D, A, … */
const FIFTHS = Array.from({ length: 12 }, (_, i) => (i * 7) % 12)

/** A whole rest hanging from the staff: a bar of silence. */
function Tacet() {
  return (
    <svg aria-hidden="true" viewBox="0 0 120 44" className="h-11 w-30">
      {[6, 14, 22, 30, 38].map((y) => (
        <line key={y} x1="0" x2="120" y1={y} y2={y} stroke="var(--staff-line)" strokeWidth="1" />
      ))}
      <rect x="50" y="14" width="20" height="5" fill="var(--ebony)" />
    </svg>
  )
}
const savedSort = (): Sort => {
  const s = localStorage.getItem(SORT_KEY)
  return s === 'title' || s === 'key' ? s : 'added'
}

export function Library({ store, onSignOut }: { store: SongStore; onSignOut?: () => void }) {
  const [notice, setNotice] = useState<string | null>(null)
  const { songs, status, reload, add, update, remove } = useSongs(store, setNotice)
  const [filters, setFiltersState] = useState<Filters>(EMPTY_FILTERS)
  const [sort, setSort] = useState<Sort>(savedSort)
  const [openId, setOpenId] = useState<string | null>(null)
  const [bulkOpen, setBulkOpen] = useState(false)
  const [lastAddedId, setLastAddedId] = useState<string | null>(null)
  // The "added but hidden" hint only applies to filters that were on when the song was added.
  const setFilters = (f: Filters) => {
    setFiltersState(f)
    setLastAddedId(null)
  }
  const quickRef = useRef<HTMLInputElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  const visible = useMemo(() => sortSongs(songs.filter((s) => matches(s, filters)), sort), [songs, filters, sort])
  const allTags = useMemo(() => [...new Set(songs.flatMap((s) => s.tags))].sort(), [songs])
  const openSong = songs.find((s) => s.id === openId)
  const lastAdded = songs.find((s) => s.id === lastAddedId)
  const addedButHidden = lastAdded && hasActiveFilters(filters) && !matches(lastAdded, filters)

  // N jumps to Quick Add and / to search, unless you're already typing somewhere.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const t = e.target as HTMLElement
      if (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName)) return
      if (document.querySelector('dialog[open]')) return
      const target = e.key.toLowerCase() === 'n' ? quickRef.current : e.key === '/' ? searchRef.current : null
      if (target) {
        e.preventDefault()
        target.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const quickAdd = useCallback(
    async (title: string) => {
      const [saved] = await add([{ title }])
      setLastAddedId(saved.id)
    },
    [add],
  )

  const onSort = (next: Sort) => {
    setSort(next)
    localStorage.setItem(SORT_KEY, next)
  }

  return (
    <div className="pb-[max(2rem,env(safe-area-inset-bottom))]">
      {/* The twelve key colours, in circle-of-fifths order. */}
      <div aria-hidden="true" className="spectrum">
        {FIFTHS.map((pc) => (
          <span key={pc} style={hueStyle(pc)} />
        ))}
      </div>

      <div className="mx-auto max-w-5xl">
        <header className="flex items-center gap-3 px-4 pt-5 pb-4">
          <Logo />
          <h1 className="font-display text-5xl leading-none">Reprise</h1>
          <div aria-hidden="true" className="staff mx-2 hidden flex-1 sm:block" />
          <div className="ml-auto flex gap-2">
            <button className="btn" onClick={() => setBulkOpen(true)}>
              Bulk Add
            </button>
            {onSignOut && (
              <button className="btn" onClick={onSignOut}>
                Sign Out
              </button>
            )}
          </div>
        </header>

        {!onSignOut && (
          <p className="mx-4 mb-4 rounded-lg bg-brass-soft px-3 py-2 text-sm">
            Local mode: songs are saved in this browser only. Add Supabase keys to sync across devices.
          </p>
        )}

        <main className="flex flex-col gap-4 px-4">
          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_22rem]">
            <div className="flex flex-col gap-3">
              <QuickAdd inputRef={quickRef} onAdd={quickAdd} />
              {addedButHidden && (
                <p role="status" className="text-sm text-ink-2">
                  “{lastAdded.title}” was added but doesn’t match your filters.{' '}
                  <button className="text-accent underline" onClick={() => setFilters(EMPTY_FILTERS)}>
                    Clear filters
                  </button>
                </p>
              )}
              <FilterControls songs={songs} filters={filters} searchRef={searchRef} onFilters={setFilters} />
            </div>
            <KeyFilter songs={songs} filters={filters} onFilters={setFilters} />
          </div>

          <FilterSummary songs={songs} filters={filters} sort={sort} shown={visible.length} onFilters={setFilters} onSort={onSort} />

          {status === 'loading' && <p className="text-ink-2">Loading your songs…</p>}
          {status === 'error' && (
            <div role="alert" className="flex flex-wrap items-center gap-3">
              <p>Couldn’t load your songs. Check your connection.</p>
              <button className="btn" onClick={reload}>
                Try Again
              </button>
            </div>
          )}
          {status === 'ready' && visible.length === 0 && (
            <div className="flex flex-col items-center gap-3 rounded-2xl border border-line bg-card px-4 py-10 text-center shadow-card">
              <Tacet />
              <p className="font-display text-3xl italic">Tacet</p>
              {songs.length === 0 ? (
                <p className="max-w-sm text-ink-2">No songs yet. Type a title above and press Enter, or use Bulk Add to paste a list.</p>
              ) : (
                <>
                  <p className="text-ink-2">No songs match these filters.</p>
                  <button className="btn" onClick={() => setFilters(EMPTY_FILTERS)}>
                    Clear Filters
                  </button>
                </>
              )}
            </div>
          )}

          {visible.length > 0 && (
            <div className="overflow-hidden rounded-2xl border border-line bg-card shadow-card">
              <div aria-hidden="true" className={`${ROW_GRID} hidden border-b border-line bg-bg py-2 text-xs font-medium tracking-wide text-ink-2 uppercase md:grid`}>
                <span>Title</span>
                <span>Key</span>
                <span>Recall</span>
                <span>Confidence</span>
                <span>Tags</span>
                <span>Score</span>
              </div>
              <ul aria-label="Songs">
                {visible.map((song) => (
                  <SongRow key={song.id} song={song} onPatch={(patch) => update(song.id, patch)} onOpen={() => setOpenId(song.id)} />
                ))}
              </ul>
            </div>
          )}
        </main>
      </div>

      {openSong && (
        <SongDetail
          key={openSong.id}
          song={openSong}
          allTags={allTags}
          onPatch={(patch) => update(openSong.id, patch)}
          onClose={() => setOpenId(null)}
          onDelete={() => {
            setOpenId(null)
            remove(openSong.id)
          }}
        />
      )}
      {bulkOpen && <BulkAdd existing={songs} onAdd={add} onClose={() => setBulkOpen(false)} />}

      {notice && (
        <div role="alert" className="fixed inset-x-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-50 mx-auto flex max-w-md items-center gap-3 rounded-xl border border-danger bg-card px-4 py-2 text-sm shadow-lg">
          <p className="min-w-0 flex-1">{notice}</p>
          <button className="btn" onClick={() => setNotice(null)}>
            Dismiss
          </button>
        </div>
      )}
    </div>
  )
}
