import { useRef, useState, type FormEvent, type KeyboardEvent, type PointerEvent } from 'react'
import { moved, swapCandidates } from '../lib/medley'
import { keyLabel, songKeyId, type SetPatch, type Song, type SongSet } from '../lib/songs'
import { fold } from '../lib/text'
import { KeyBadge } from './controls'
import { CommitInput } from './SongDetail'
import { StandView } from './StandView'

const songsWord = (n: number) => `${n} ${n === 1 ? 'song' : 'songs'}`

function SetList({ sets, songsById, onOpen, onCreate }: { sets: SongSet[]; songsById: Map<string, Song>; onOpen: (id: string) => void; onCreate: (name: string) => void }) {
  const [name, setName] = useState('')
  function submit(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    onCreate(name.trim())
    setName('')
  }
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="font-display text-4xl leading-tight">Sets</h2>
        <p className="text-sm text-ink-2">A set is a named run of songs in the order you’ll play them.</p>
      </div>
      <form onSubmit={submit} className="flex max-w-md gap-2">
        <input className="field" aria-label="New set name" placeholder="Name a new set" value={name} onChange={(e) => setName(e.target.value)} />
        <button className="btn btn-primary" disabled={!name.trim()}>
          Create Set
        </button>
      </form>
      {sets.length === 0 ? (
        <p className="rounded-2xl border border-line bg-card px-4 py-10 text-center text-ink-2 shadow-card">
          <span className="block font-display text-3xl text-ink italic">No sets yet</span>
          Name one above, or star songs in Medley and save them as a set.
        </p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sets.map((set) => {
            const songs = set.song_ids.map((id) => songsById.get(id)).filter((s): s is Song => !!s)
            return (
              <li key={set.id}>
                <button onClick={() => onOpen(set.id)} className="flex h-full w-full flex-col gap-2 rounded-2xl border border-line bg-card p-4 text-left shadow-card hover:border-ink-2">
                  <span className="font-display text-3xl leading-tight">{set.name}</span>
                  <span className="text-sm text-ink-2">{songsWord(songs.length)}</span>
                  <span className="flex flex-wrap gap-1">
                    {songs.slice(0, 6).map((s) => (
                      <KeyBadge key={s.id} song={s} />
                    ))}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

function SetEditor({
  set,
  songs,
  songsById,
  onPatch,
  onDelete,
  onBack,
}: {
  set: SongSet
  songs: Song[]
  songsById: Map<string, Song>
  onPatch: (patch: SetPatch) => void
  onDelete: () => void
  onBack: () => void
}) {
  // Ids of songs deleted since they were added are dropped on the next save.
  const saved = set.song_ids.filter((id) => songsById.has(id))
  const [draft, setDraft] = useState<string[] | null>(null) // order while dragging
  const [dragging, setDragging] = useState<string | null>(null)
  const [swapping, setSwapping] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [playing, setPlaying] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const listRef = useRef<HTMLOListElement>(null)
  const ids = draft ?? saved
  const idsRef = useRef(ids)
  idsRef.current = ids

  const inSet = ids.map((id) => songsById.get(id)!)
  const words = fold(query).split(' ').filter(Boolean)
  const matches = words.length
    ? songs.filter((s) => !ids.includes(s.id) && words.every((w) => fold(`${s.title} ${s.artist ?? ''}`).includes(w))).slice(0, 8)
    : []

  // Dragging: follow the pointer, moving the row into whichever slot it is over.
  function dragStart(e: PointerEvent<HTMLButtonElement>, id: string) {
    e.currentTarget.setPointerCapture(e.pointerId)
    setDragging(id)
    setDraft(saved)
    setSwapping(null)
  }
  function dragMove(e: PointerEvent<HTMLButtonElement>) {
    if (!dragging || !listRef.current) return
    const from = idsRef.current.indexOf(dragging)
    const over = [...listRef.current.children].findIndex((row) => {
      const r = row.getBoundingClientRect()
      return e.clientY >= r.top && e.clientY < r.bottom
    })
    if (over >= 0 && over !== from) setDraft(moved(idsRef.current, from, over))
  }
  function dragEnd() {
    if (!dragging) return
    if (draft && draft.join() !== saved.join()) onPatch({ song_ids: draft })
    setDragging(null)
    setDraft(null)
  }
  function nudge(e: KeyboardEvent, index: number) {
    const to = e.key === 'ArrowUp' ? index - 1 : e.key === 'ArrowDown' ? index + 1 : -1
    if (to < 0 || to >= saved.length) return
    e.preventDefault()
    onPatch({ song_ids: moved(saved, index, to) })
  }

  return (
    <div className="flex flex-col gap-4">
      <button className="btn self-start" onClick={onBack}>
        ← All Sets
      </button>

      <div className="flex flex-wrap items-end gap-3">
        <label className="flex min-w-0 flex-1 basis-64 flex-col gap-1 text-sm font-medium">
          Set name
          <CommitInput value={set.name} onCommit={(d) => (d.trim() ? onPatch({ name: d.trim() }) : false)} />
        </label>
        <button className="btn btn-primary" disabled={inSet.length === 0} onClick={() => setPlaying(true)}>
          Play Set
        </button>
      </div>

      {inSet.length === 0 ? (
        <p className="rounded-2xl border border-line bg-card px-4 py-8 text-center text-ink-2 shadow-card">This set is empty. Search below to add songs.</p>
      ) : (
        <ol ref={listRef} aria-label={`Songs in ${set.name}`} className="overflow-hidden rounded-2xl border border-line bg-card shadow-card">
          {inSet.map((song, i) => {
            const candidates = swapping === song.id ? swapCandidates(song, songs, ids) : []
            const keyId = songKeyId(song)
            return (
              <li key={song.id} className={`border-b border-line last:border-b-0 ${dragging === song.id ? 'dragging' : ''}`}>
                <div className="flex flex-wrap items-center gap-2 py-1.5 pr-3 pl-1">
                  <button
                    type="button"
                    aria-label={`Move ${song.title}. Drag, or use the up and down arrow keys`}
                    onPointerDown={(e) => dragStart(e, song.id)}
                    onPointerMove={dragMove}
                    onPointerUp={dragEnd}
                    onPointerCancel={dragEnd}
                    onKeyDown={(e) => nudge(e, i)}
                    className="flex h-11 w-9 shrink-0 cursor-grab touch-none items-center justify-center rounded-md text-ink-2 hover:bg-surface active:cursor-grabbing"
                  >
                    <svg aria-hidden="true" viewBox="0 0 16 16" className="h-4 w-4" fill="currentColor">
                      {[3.5, 8, 12.5].flatMap((y) => [5.5, 10.5].map((x) => <circle key={`${x}-${y}`} cx={x} cy={y} r="1.3" />))}
                    </svg>
                  </button>
                  <span className="w-6 shrink-0 text-right font-display text-2xl leading-none text-ink-2 tabular-nums">{i + 1}</span>
                  <span className="min-w-0 flex-1 basis-[60%] pl-1 md:basis-0">
                    <span className="block truncate text-[1.0625rem] font-medium md:text-base">{song.title}</span>
                    {song.artist && <span className="block truncate text-sm text-ink-2">{song.artist}</span>}
                  </span>
                  {/* On a phone these drop to a second line so the title keeps its width. */}
                  <span className="ml-auto flex items-center gap-2">
                  <KeyBadge song={song} />
                  <button className="btn" aria-expanded={swapping === song.id} disabled={!keyId} onClick={() => setSwapping(swapping === song.id ? null : song.id)}>
                    Swap
                  </button>
                  <button className="btn" aria-label={`Remove ${song.title} from the set`} onClick={() => onPatch({ song_ids: saved.filter((id) => id !== song.id) })}>
                    <span aria-hidden="true">×</span>
                  </button>
                  </span>
                </div>
                {swapping === song.id && keyId && (
                  <div className="border-t border-line bg-bg px-4 py-3">
                    {candidates.length === 0 ? (
                      <p className="text-sm text-ink-2">No other songs in {keyLabel(keyId)} to swap in.</p>
                    ) : (
                      <>
                        <p className="mb-2 text-sm text-ink-2">Swap for another song in {keyLabel(keyId)}:</p>
                        <ul className="flex flex-wrap gap-2">
                          {candidates.map((c) => (
                            <li key={c.id}>
                              <button
                                className="btn"
                                onClick={() => {
                                  onPatch({ song_ids: saved.map((id) => (id === song.id ? c.id : id)) })
                                  setSwapping(null)
                                }}
                              >
                                {c.title}
                              </button>
                            </li>
                          ))}
                        </ul>
                      </>
                    )}
                  </div>
                )}
              </li>
            )
          })}
        </ol>
      )}

      <section aria-label="Add songs" className="flex flex-col gap-2">
        <input
          type="search"
          className="field max-w-md"
          aria-label="Search your library to add songs"
          placeholder="Search your library to add songs"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {words.length > 0 &&
          (matches.length === 0 ? (
            <p className="text-sm text-ink-2">No songs match, or they’re already in the set.</p>
          ) : (
            <ul className="max-w-md overflow-hidden rounded-xl border border-line bg-card">
              {matches.map((s) => (
                <li key={s.id} className="border-b border-line last:border-b-0">
                  <button
                    aria-label={`Add ${s.title} to the set`}
                    onClick={() => onPatch({ song_ids: [...saved, s.id] })}
                    className="flex min-h-11 w-full items-center gap-3 px-3 py-1.5 text-left hover:bg-bg"
                  >
                    <span aria-hidden="true" className="text-lg leading-none text-accent">
                      +
                    </span>
                    <span className="min-w-0 flex-1 truncate">{s.title}</span>
                    <KeyBadge song={s} />
                  </button>
                </li>
              ))}
            </ul>
          ))}
      </section>

      <div className="border-t border-line pt-4">
        {confirmingDelete ? (
          <div role="alertdialog" aria-label="Confirm delete" className="flex flex-wrap items-center gap-2">
            <p className="mr-2 text-sm">Delete the set “{set.name}”? Its songs stay in your library. This can’t be undone.</p>
            <button className="btn" autoFocus onClick={() => setConfirmingDelete(false)}>
              Cancel
            </button>
            <button className="btn btn-danger" onClick={onDelete}>
              Delete Set
            </button>
          </div>
        ) : (
          <button className="btn btn-danger" onClick={() => setConfirmingDelete(true)}>
            Delete Set…
          </button>
        )}
      </div>

      {playing && <StandView title={set.name} subtitle={songsWord(inSet.length)} songs={inSet} numbered showKeys onClose={() => setPlaying(false)} />}
    </div>
  )
}

/** Build named, ordered sets and play them from a large-type view. */
export function SetsView({
  songs,
  sets,
  openSetId,
  onOpenSet,
  onCreate,
  onPatch,
  onDelete,
}: {
  songs: Song[]
  sets: SongSet[]
  openSetId: string | null
  onOpenSet: (id: string | null) => void
  onCreate: (name: string) => void
  onPatch: (id: string, patch: SetPatch) => void
  onDelete: (id: string) => void
}) {
  const songsById = new Map(songs.map((s) => [s.id, s]))
  const open = sets.find((s) => s.id === openSetId)
  if (!open) return <SetList sets={sets} songsById={songsById} onOpen={onOpenSet} onCreate={onCreate} />
  return (
    <SetEditor
      key={open.id}
      set={open}
      songs={songs}
      songsById={songsById}
      onPatch={(patch) => onPatch(open.id, patch)}
      onBack={() => onOpenSet(null)}
      onDelete={() => {
        onOpenSet(null)
        onDelete(open.id)
      }}
    />
  )
}
