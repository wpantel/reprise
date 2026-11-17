import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { EMPTY_FILTERS, hasActiveFilters, matches, sortSongs, type Filters, type Sort } from '../lib/filters'
import { EMPTY_MEDLEY, type MedleyState } from '../lib/medley'
import { agoLabel, daysSince, isSameDay, lastPlays, recentlyPlayed, reviveGroups } from '../lib/history'
import type { Play, Song } from '../lib/songs'
import type { SongStore } from '../lib/store'
import { useSongs } from '../lib/useSongs'
import { AnalyticsView } from './AnalyticsView'
import { BulkAdd } from './BulkAdd'
import { Logo } from './controls'
import { MedleyView } from './MedleyView'
import { SetsView } from './SetsView'
import { FilterControls, FilterSummary, KeyFilter } from './FilterBar'
import { hueStyle } from './Piano'
import { QuickAdd } from './QuickAdd'
import { ReviveView } from './ReviveView'
import { SongDetail } from './SongDetail'
import { ROW_GRID, SongRow } from './SongRow'

const SORT_KEY = 'repertoire.sort'
/** Pitch classes in circle-of-fifths order: C, G, D, A, … */
const FIFTHS = Array.from({ length: 12 }, (_, i) => (i * 7) % 12)

type View = 'library' | 'medley' | 'sets' | 'revive' | 'analytics'
const VIEWS: { id: View; label: string }[] = [
  { id: 'library', label: 'Library' },
  { id: 'medley', label: 'Medley' },
  { id: 'sets', label: 'Sets' },
  { id: 'revive', label: 'Revive' },
  { id: 'analytics', label: 'Analytics' },
]
const viewFromHash = (): View => VIEWS.find((v) => `#${v.id}` === location.hash)?.id ?? 'library'

interface Notice {
  text: string
  error?: boolean
  action?: { label: string; run: () => void }
}

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
  const [notice, setNotice] = useState<Notice | null>(null)
  const onError = useCallback((text: string) => setNotice({ text, error: true }), [])
  const { songs, plays, sets, status, reload, add, update, remove, logPlay, removePlay, createSet, updateSet, removeSet } = useSongs(store, onError)
  const [view, setViewState] = useState<View>(viewFromHash)
  const [filters, setFiltersState] = useState<Filters>(EMPTY_FILTERS)
  const [sort, setSort] = useState<Sort>(savedSort)
  const [openId, setOpenId] = useState<string | null>(null)
  const [bulkOpen, setBulkOpen] = useState(false)
  const [medley, setMedley] = useState<MedleyState>(EMPTY_MEDLEY)
  const [openSetId, setOpenSetId] = useState<string | null>(null)
  const [lastAddedId, setLastAddedId] = useState<string | null>(null)
  // The "added but hidden" hint only applies to filters that were on when the song was added.
  const setFilters = (f: Filters) => {
    setFiltersState(f)
    setLastAddedId(null)
  }
  const setView = (v: View) => {
    setViewState(v)
    history.replaceState(null, '', v === 'library' ? location.pathname : `#${v}`)
  }
  const quickRef = useRef<HTMLInputElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  const now = new Date()
  const today = now.toDateString()
  const last = useMemo(() => lastPlays(plays), [plays])
  const recent = useMemo(() => recentlyPlayed(plays, new Date()), [plays, today]) // eslint-disable-line react-hooks/exhaustive-deps
  const dueCount = useMemo(() => reviveGroups(songs, plays, new Date()).due.length, [songs, plays, today]) // eslint-disable-line react-hooks/exhaustive-deps
  const visible = useMemo(() => sortSongs(songs.filter((s) => matches(s, filters, recent)), sort), [songs, filters, sort, recent])
  const allTags = useMemo(() => [...new Set(songs.flatMap((s) => s.tags))].sort(), [songs])
  const openSong = songs.find((s) => s.id === openId)
  const lastAdded = songs.find((s) => s.id === lastAddedId)
  const addedButHidden = lastAdded && hasActiveFilters(filters) && !matches(lastAdded, filters, recent)

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

  // Confirmations clear themselves; errors stay until dismissed.
  useEffect(() => {
    if (!notice || notice.error) return
    const timer = setTimeout(() => setNotice(null), 8000)
    return () => clearTimeout(timer)
  }, [notice])

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

  /** Records a play and offers to undo it. */
  async function played(song: Song, feltRusty: boolean) {
    const saved = await logPlay(song.id, feltRusty)
    if (saved) {
      setNotice({
        text: `Marked “${song.title}” as played${feltRusty ? ', felt rusty' : ''}.`,
        action: { label: 'Undo', run: () => removePlay(saved) },
      })
    }
  }
  /** Saves a set and opens it in the set builder. */
  async function saveSet(name: string, songIds: string[]) {
    const saved = await createSet(name, songIds)
    if (saved) {
      setOpenSetId(saved.id)
      setView('sets')
      window.scrollTo({ top: 0 })
    }
  }
  const todaysPlay = (songId: string): Play | undefined => {
    const p = last.get(songId)
    return p && isSameDay(p.played_at, now) ? p : undefined
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
        <header className="flex flex-wrap items-center gap-x-3 gap-y-3 px-4 pt-5 pb-4">
          <Logo />
          <h1 className="font-display text-5xl leading-none">Reprise</h1>
          <div aria-hidden="true" className="staff mx-2 hidden flex-1 lg:block" />
          <nav aria-label="Views" className="seg seg-nav order-last w-full md:order-none md:ml-auto md:w-auto lg:ml-0">
            {VIEWS.map((v) => (
              <button key={v.id} className="flex-1" aria-current={view === v.id ? 'page' : undefined} onClick={() => setView(v.id)}>
                {v.label}
                {v.id === 'revive' && dueCount > 0 && (
                  <span className="ml-1.5 rounded-full bg-felt px-1.5 py-0.5 text-xs font-semibold text-white" aria-label={`${dueCount} due`}>
                    {dueCount}
                  </span>
                )}
              </button>
            ))}
          </nav>
          <div className="ml-auto flex gap-2 md:ml-0">
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
          {status === 'loading' && <p className="text-ink-2">Loading your songs…</p>}
          {status === 'error' && (
            <div role="alert" className="flex flex-wrap items-center gap-3">
              <p>Couldn’t load your songs. Check your connection.</p>
              <button className="btn" onClick={reload}>
                Try Again
              </button>
            </div>
          )}

          {view === 'medley' && status === 'ready' && <MedleyView songs={songs} medley={medley} onMedley={setMedley} onSaveSet={saveSet} />}

          {view === 'sets' && status === 'ready' && (
            <SetsView
              songs={songs}
              sets={sets}
              openSetId={openSetId}
              onOpenSet={setOpenSetId}
              onCreate={(name) => saveSet(name, [])}
              onPatch={updateSet}
              onDelete={removeSet}
            />
          )}

          {view === 'revive' && status === 'ready' && (
            <ReviveView songs={songs} plays={plays} onOpen={(s) => setOpenId(s.id)} onPlayed={played} />
          )}

          {view === 'analytics' && status === 'ready' && (
            <AnalyticsView
              songs={songs}
              plays={plays}
              onShow={(patch) => {
                setFilters({ ...EMPTY_FILTERS, ...patch })
                setView('library')
                window.scrollTo({ top: 0 })
              }}
            />
          )}

          {view === 'library' && (
            <>
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
              {hasActiveFilters(filters) && visible.length > 0 && (
                <button
                  className="btn self-start"
                  onClick={() =>
                    saveSet(
                      'Untitled set',
                      visible.filter((s) => !s.pending).map((s) => s.id),
                    )
                  }
                >
                  Save These {visible.length} as a Set
                </button>
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
                    <span>Played</span>
                    <span>Score</span>
                  </div>
                  <ul aria-label="Songs">
                    {visible.map((song) => {
                      const lastPlay = last.get(song.id)
                      const todays = todaysPlay(song.id)
                      return (
                        <SongRow
                          key={song.id}
                          song={song}
                          playedToday={!!todays}
                          lastPlayed={lastPlay ? agoLabel(daysSince(lastPlay.played_at, now)) : null}
                          onPatch={(patch) => update(song.id, patch)}
                          onOpen={() => setOpenId(song.id)}
                          onTogglePlayed={() => (todays ? removePlay(todays) : played(song, false))}
                        />
                      )
                    })}
                  </ul>
                </div>
              )}
            </>
          )}
        </main>
      </div>

      {openSong && (
        <SongDetail
          key={openSong.id}
          song={openSong}
          plays={plays.filter((p) => p.song_id === openSong.id)}
          allTags={allTags}
          onPlayed={(rusty) => logPlay(openSong.id, rusty)}
          onUndoPlay={removePlay}
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
        <div
          role={notice.error ? 'alert' : 'status'}
          className={`fixed inset-x-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-50 mx-auto flex max-w-md items-center gap-2 rounded-xl border bg-card px-4 py-2 text-sm shadow-card ${
            notice.error ? 'border-danger' : 'border-line'
          }`}
        >
          <p className="min-w-0 flex-1">{notice.text}</p>
          {notice.action && (
            <button
              className="btn"
              onClick={() => {
                notice.action!.run()
                setNotice(null)
              }}
            >
              {notice.action.label}
            </button>
          )}
          <button className="btn" onClick={() => setNotice(null)}>
            Dismiss
          </button>
        </div>
      )}
    </div>
  )
}
