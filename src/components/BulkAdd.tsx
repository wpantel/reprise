import { useMemo, useState } from 'react'
import { flagDuplicates, parseBulk } from '../lib/bulk'
import type { NewSong, Song } from '../lib/songs'
import { Modal } from './Modal'

const FLAG_TEXT = { in_library: 'Already in your library', repeated: 'Repeated in this list', new: '' }

export function BulkAdd({
  existing,
  onAdd,
  onClose,
}: {
  existing: Song[]
  onAdd: (songs: NewSong[]) => Promise<unknown>
  onClose: () => void
}) {
  const [text, setText] = useState('')
  const [splitArtist, setSplitArtist] = useState(true)
  const [reviewing, setReviewing] = useState(false)
  const [included, setIncluded] = useState<boolean[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(false)

  const entries = useMemo(() => parseBulk(text, splitArtist), [text, splitArtist])
  const flags = useMemo(() => flagDuplicates(entries, existing), [entries, existing])
  const chosen = entries.filter((_, i) => included[i])
  const flaggedCount = flags.filter((f) => f !== 'new').length

  function review() {
    setIncluded(flags.map((f) => f === 'new')) // likely duplicates start unticked
    setReviewing(true)
  }
  async function submit() {
    setBusy(true)
    setError(false)
    try {
      await onAdd(chosen)
      onClose()
    } catch {
      setError(true)
      setBusy(false)
    }
  }

  return (
    <Modal label="Bulk add songs" shape="center" onClose={onClose}>
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <h2 className="text-lg font-semibold">{reviewing ? 'Review Songs' : 'Bulk Add'}</h2>
        <button className="btn" onClick={onClose}>
          Cancel
        </button>
      </div>

      {!reviewing ? (
        <div className="flex flex-col gap-3 p-4">
          <label className="flex flex-col gap-1 text-sm font-medium">
            One song per line
            <textarea
              className="field min-h-56 font-normal"
              autoFocus
              placeholder={'Clair de Lune - Debussy\nRiver Flows in You\nYesterday'}
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
          </label>
          <label className="flex min-h-11 items-center gap-2 text-sm">
            <input type="checkbox" className="h-4 w-4 accent-(--accent)" checked={splitArtist} onChange={(e) => setSplitArtist(e.target.checked)} />
            Read “Title - Artist” lines as a title and an artist
          </label>
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-ink-2" aria-live="polite">
              {entries.length} {entries.length === 1 ? 'song' : 'songs'}
            </p>
            <button className="btn btn-primary" disabled={entries.length === 0} onClick={review}>
              Review
            </button>
          </div>
        </div>
      ) : (
        <>
          {flaggedCount > 0 && (
            <p className="border-b border-line bg-surface px-4 py-2 text-sm">
              {flaggedCount} {flaggedCount === 1 ? 'looks like a duplicate and is' : 'look like duplicates and are'} unticked. Tick any you
              want to add anyway.
            </p>
          )}
          <ul className="min-h-0 flex-1 overflow-y-auto">
            {entries.map((entry, i) => (
              <li key={i} className="border-b border-line">
                <label className="flex min-h-11 items-center gap-3 px-4 py-1.5">
                  <input
                    type="checkbox"
                    className="h-4 w-4 shrink-0 accent-(--accent)"
                    checked={included[i] ?? false}
                    onChange={(e) => setIncluded((cur) => cur.map((v, j) => (j === i ? e.target.checked : v)))}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{entry.title}</span>
                    {entry.artist && <span className="block truncate text-sm text-ink-2">{entry.artist}</span>}
                  </span>
                  {flags[i] !== 'new' && <span className="shrink-0 text-sm text-ink-2">{FLAG_TEXT[flags[i]]}</span>}
                </label>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line p-4">
            <button className="btn" disabled={busy} onClick={() => setReviewing(false)}>
              Back
            </button>
            {error && (
              <p role="alert" className="min-w-0 flex-1 text-sm text-danger">
                Couldn’t save. Your list is still here. Check your connection and try again.
              </p>
            )}
            <button className="btn btn-primary" disabled={busy || chosen.length === 0} onClick={submit}>
              {busy ? 'Adding…' : `Add ${chosen.length} ${chosen.length === 1 ? 'Song' : 'Songs'}`}
            </button>
          </div>
        </>
      )}
    </Modal>
  )
}
