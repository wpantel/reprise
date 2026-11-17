import { useEffect, useId, useRef, useState, type InputHTMLAttributes } from 'react'
import { detectArrangementType, normalizeUrl } from '../lib/arrangement'
import { ARRANGEMENT_TYPES, type ArrangementType, type Song, type SongPatch } from '../lib/songs'
import { ConfidenceDots, KeySelect, RecallSelect } from './controls'
import { Modal } from './Modal'

/** A text input that saves when you leave it, press Enter, or close the panel. */
function CommitInput({
  value,
  onCommit,
  ...rest
}: { value: string; onCommit: (draft: string) => void | false } & Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'>) {
  const [draft, setDraft] = useState(value)
  useEffect(() => setDraft(value), [value])
  const latest = useRef({ draft, value, onCommit })
  latest.current = { draft, value, onCommit }
  const commit = () => {
    const { draft, value, onCommit } = latest.current
    if (draft !== value && onCommit(draft) === false) setDraft(value)
  }
  useEffect(() => commit, []) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <input
      {...rest}
      className="field"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
    />
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-sm font-medium">
      {label}
      {children}
    </label>
  )
}

export function SongDetail({
  song,
  allTags,
  onPatch,
  onDelete,
  onClose,
}: {
  song: Song
  allTags: string[]
  onPatch: (patch: SongPatch) => void
  onDelete: () => void
  onClose: () => void
}) {
  const [urlError, setUrlError] = useState(false)
  const [tagDraft, setTagDraft] = useState('')
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const tagListId = useId()

  function commitUrl(raw: string) {
    setUrlError(false)
    if (!raw.trim()) return onPatch({ arrangement_url: null, arrangement_type: null })
    const url = normalizeUrl(raw)
    if (!url) return setUrlError(true)
    // Use the type the link makes obvious; otherwise keep what was chosen.
    onPatch({ arrangement_url: url, arrangement_type: detectArrangementType(url) ?? song.arrangement_type ?? 'other' })
  }

  function addTag() {
    const tag = tagDraft.trim().replace(/^#/, '').toLowerCase()
    setTagDraft('')
    if (tag && !song.tags.includes(tag)) onPatch({ tags: [...song.tags, tag] })
  }

  return (
    <Modal label={`Details for ${song.title}`} shape="panel" onClose={onClose}>
      <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-line bg-bg px-4 py-3">
        <h2 className="min-w-0 truncate text-lg font-semibold">{song.title}</h2>
        <button className="btn btn-primary" onClick={onClose}>
          Done
        </button>
      </div>

      <div className="flex flex-col gap-4 p-4">
        <Field label="Title">
          <CommitInput value={song.title} onCommit={(d) => (d.trim() ? onPatch({ title: d.trim() }) : false)} />
        </Field>
        <Field label="Artist or composer">
          <CommitInput value={song.artist ?? ''} onCommit={(d) => onPatch({ artist: d.trim() || null })} />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Key I play it in">
            <KeySelect song={song} label="Key I play it in" variant="field" onChange={onPatch} />
          </Field>
          <Field label="Recall">
            <RecallSelect value={song.recall} label="Recall" variant="field" onChange={onPatch} />
          </Field>
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium">Confidence</span>
          <div className="-ml-3">
            <ConfidenceDots value={song.confidence} title={song.title} size="lg" onChange={onPatch} />
          </div>
          <p className="text-xs text-ink-2">1 is “I can get through it”. 5 is “I’d play it for someone right now”.</p>
        </div>

        <fieldset className="flex flex-col gap-3 border-t border-line pt-4">
          <legend className="sr-only">Arrangement</legend>
          <Field label="Arrangement link">
            <CommitInput
              value={song.arrangement_url ?? ''}
              onCommit={commitUrl}
              type="url"
              inputMode="url"
              autoCapitalize="off"
              autoCorrect="off"
              placeholder="Paste a link"
              aria-invalid={urlError}
            />
          </Field>
          {urlError && (
            <p role="alert" className="text-sm text-danger">
              That isn’t a web link. Paste the full address, like https://musescore.com/…
            </p>
          )}
          {song.arrangement_url && (
            <div className="flex items-end gap-3">
              <div className="flex-1">
                <Field label="Link type">
                  <select
                    className="field"
                    value={song.arrangement_type ?? 'other'}
                    onChange={(e) => onPatch({ arrangement_type: e.target.value as ArrangementType })}
                  >
                    {ARRANGEMENT_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
              <a className="btn" href={song.arrangement_url} target="_blank" rel="noopener noreferrer">
                Open
              </a>
            </div>
          )}
        </fieldset>

        <div className="flex flex-col gap-2 border-t border-line pt-4">
          <Field label="Tags">
            <input
              className="field"
              list={tagListId}
              placeholder="Add a tag, then press Enter"
              autoCapitalize="off"
              value={tagDraft}
              onChange={(e) => setTagDraft(e.target.value)}
              onBlur={addTag}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ',') {
                  e.preventDefault()
                  addTag()
                }
              }}
            />
          </Field>
          <datalist id={tagListId}>
            {allTags
              .filter((t) => !song.tags.includes(t))
              .map((t) => (
                <option key={t} value={t} />
              ))}
          </datalist>
          {song.tags.length > 0 && (
            <ul aria-label="Tags on this song" className="flex flex-wrap gap-2">
              {song.tags.map((t) => (
                <li key={t}>
                  <button
                    aria-label={`Remove tag ${t}`}
                    onClick={() => onPatch({ tags: song.tags.filter((x) => x !== t) })}
                    className="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-surface pr-2.5 pl-3 text-sm"
                  >
                    {t}
                    <span aria-hidden="true">×</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="border-t border-line pt-4">
          {confirmingDelete ? (
            <div role="alertdialog" aria-label="Confirm delete" className="flex flex-col gap-3">
              <p className="text-sm">Delete “{song.title}” from your library? This can’t be undone.</p>
              <div className="flex gap-2">
                <button className="btn flex-1" autoFocus onClick={() => setConfirmingDelete(false)}>
                  Cancel
                </button>
                <button className="btn btn-danger flex-1" onClick={onDelete}>
                  Delete Song
                </button>
              </div>
            </div>
          ) : (
            <button className="btn btn-danger" onClick={() => setConfirmingDelete(true)}>
              Delete Song…
            </button>
          )}
        </div>
      </div>
    </Modal>
  )
}
