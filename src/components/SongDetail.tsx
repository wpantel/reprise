import { useEffect, useId, useRef, useState, type InputHTMLAttributes } from 'react'
import { detectArrangementType, normalizeUrl } from '../lib/arrangement'
import {
  ARRANGEMENT_TYPES,
  PITCH_NAMES,
  pitchClass,
  spellings,
  tonicLabel,
  type ArrangementType,
  type Mode,
  type Play,
  type Song,
  type SongPatch,
} from '../lib/songs'
import { agoLabel, daysSince, isSameDay } from '../lib/history'
import { playKey } from '../lib/sound'
import { Dynamics, KeyBadge, RecallSelect } from './controls'
import { Modal } from './Modal'
import { Piano } from './Piano'

/** Pick a key by pressing it on the keyboard, then choose major or minor. */
function KeyPicker({ song, onPatch }: { song: Song; onPatch: (patch: SongPatch) => void }) {
  const [mode, setMode] = useState<Mode>(song.key_mode ?? 'major')
  const pc = song.key_tonic ? pitchClass(song.key_tonic) : null
  const options = pc === null ? [] : spellings(pc, mode)

  function choose(nextPc: number, nextMode: Mode) {
    const names = spellings(nextPc, nextMode)
    const tonic = song.key_tonic && names.includes(song.key_tonic) ? song.key_tonic : names[0]
    onPatch({ key_tonic: tonic, key_mode: nextMode })
    playKey(nextPc, nextMode)
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="mr-auto text-sm font-medium">Key I play it in</span>
        <KeyBadge song={song} />
      </div>
      <Piano
        label="Choose the key by its tonic"
        selected={pc}
        describe={(p) => `${PITCH_NAMES[p]}${p === pc ? ', selected' : ''}`}
        onPress={(p) => choose(p, mode)}
      />
      <div className="flex flex-wrap items-center gap-2">
        <div className="seg" role="group" aria-label="Major or minor">
          {(['major', 'minor'] as const).map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={mode === m}
              onClick={() => {
                setMode(m)
                if (pc !== null) choose(pc, m)
              }}
            >
              {m === 'major' ? 'Major' : 'Minor'}
            </button>
          ))}
        </div>
        {options.length > 1 && (
          <div className="seg" role="group" aria-label="Spelling">
            {options.map((t) => (
              <button key={t} type="button" aria-pressed={song.key_tonic === t} onClick={() => onPatch({ key_tonic: t, key_mode: mode })}>
                {tonicLabel(t)}
              </button>
            ))}
          </div>
        )}
        {pc !== null && (
          <button type="button" className="ml-auto min-h-9 px-1 text-sm text-ink-2 underline" onClick={() => onPatch({ key_tonic: null, key_mode: null })}>
            Clear key
          </button>
        )}
      </div>
    </div>
  )
}

/** A text input that saves when you leave it, press Enter, or close the panel. */
export function CommitInput({
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
  plays,
  allTags,
  onPlayed,
  onUndoPlay,
  onPatch,
  onDelete,
  onClose,
}: {
  song: Song
  /** This song's plays, in any order. */
  plays: Play[]
  onPlayed: (feltRusty: boolean) => void
  onUndoPlay: (play: Play) => void
  allTags: string[]
  onPatch: (patch: SongPatch) => void
  onDelete: () => void
  onClose: () => void
}) {
  const [urlError, setUrlError] = useState(false)
  const [tagDraft, setTagDraft] = useState('')
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const tagListId = useId()
  const now = new Date()
  const last = plays.reduce<Play | null>((a, b) => (!a || b.played_at > a.played_at ? b : a), null)
  const playedToday = last && isSameDay(last.played_at, now)

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
      <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-line bg-card px-4 py-3">
        <h2 className="min-w-0 truncate font-display text-3xl leading-tight">{song.title}</h2>
        <button className="btn btn-primary" onClick={onClose}>
          Done
        </button>
      </div>

      <div className="flex flex-col gap-4 p-4">
        <section aria-label="Playing" className="flex flex-col gap-2 rounded-xl bg-bg p-3">
          <p className="text-sm" role="status">
            {last ? (
              <>
                Last played <strong className="font-semibold">{agoLabel(daysSince(last.played_at, now))}</strong>
                {last.felt_rusty && ', felt rusty'} · {plays.length} {plays.length === 1 ? 'play' : 'plays'}
              </>
            ) : (
              'Not played yet.'
            )}
          </p>
          {playedToday ? (
            <button className="btn self-start" onClick={() => onUndoPlay(last)}>
              Undo Today’s Play
            </button>
          ) : (
            <div className="flex gap-2">
              <button className="btn btn-primary flex-1" onClick={() => onPlayed(false)}>
                Played
              </button>
              <button className="btn flex-1" onClick={() => onPlayed(true)}>
                Felt Rusty
              </button>
            </div>
          )}
        </section>

        <Field label="Title">
          <CommitInput value={song.title} onCommit={(d) => (d.trim() ? onPatch({ title: d.trim() }) : false)} />
        </Field>
        <Field label="Artist or composer">
          <CommitInput value={song.artist ?? ''} onCommit={(d) => onPatch({ artist: d.trim() || null })} />
        </Field>

        <KeyPicker song={song} onPatch={onPatch} />

        <Field label="Recall">
          <RecallSelect value={song.recall} label="Recall" variant="field" onChange={onPatch} />
        </Field>

        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium">Confidence</span>
          <div className="-ml-2">
            <Dynamics value={song.confidence} title={song.title} size="lg" onChange={onPatch} />
          </div>
          <p className="text-xs text-ink-2">
            From <i className="font-display text-sm">pp</i>, “I can get through it”, to <i className="font-display text-sm">ff</i>, “I’d play it for
            someone right now”.
          </p>
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
