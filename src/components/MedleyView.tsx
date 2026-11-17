import { useState, type FormEvent } from 'react'
import { EMPTY_MEDLEY, medleySongs, shuffled, type MedleyState } from '../lib/medley'
import { PITCH_NAMES, pitchClass, type Mode, type Song } from '../lib/songs'
import { playKey } from '../lib/sound'
import { RecallTag } from './controls'
import { hueStyle, Piano } from './Piano'
import { StandView, Star } from './StandView'

const MODES: { value: Mode | null; label: string }[] = [
  { value: null, label: 'All' },
  { value: 'major', label: 'Major' },
  { value: 'minor', label: 'Minor' },
]
const RECALLS: { value: MedleyState['recall']; label: string }[] = [
  { value: null, label: 'Any recall' },
  { value: 'memorized', label: 'Memorized' },
  { value: 'by_ear', label: 'By ear' },
]

/** Pick a key, get every song you play in it, shortlist a few, and read them from the stand. */
export function MedleyView({
  songs,
  medley,
  onMedley,
  onSaveSet,
}: {
  songs: Song[]
  medley: MedleyState
  onMedley: (m: MedleyState) => void
  onSaveSet: (name: string, songIds: string[]) => void
}) {
  const [onStand, setOnStand] = useState(false)
  const [naming, setNaming] = useState(false)
  const [name, setName] = useState('')

  const set = (patch: Partial<MedleyState>) => onMedley({ ...medley, ...patch })
  const list = medleySongs(songs, medley)
  // Pins only count while the song is still in the chosen key.
  const pinned = list.filter((s) => medley.pins.includes(s.id))
  const keyName = medley.pc === null ? '' : `${PITCH_NAMES[medley.pc]}${medley.mode ? ` ${medley.mode}` : ''}`

  const counts = Array<number>(12).fill(0)
  for (const s of songs) {
    if (s.key_tonic && (!medley.mode || s.key_mode === medley.mode) && (!medley.recall || s.recall === medley.recall)) counts[pitchClass(s.key_tonic)]++
  }

  const togglePin = (id: string) => set({ pins: medley.pins.includes(id) ? medley.pins.filter((p) => p !== id) : [...medley.pins, id] })
  const shuffle = () => set({ order: shuffled(list.map((s) => s.id)) })

  function saveSet(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    onSaveSet(
      name.trim(),
      pinned.map((s) => s.id),
    )
    setNaming(false)
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_22rem] md:items-end">
        <div>
          <h2 className="font-display text-4xl leading-tight">Medley</h2>
          <p className="max-w-md text-sm text-ink-2">Press a key to see every song you play in it. Star the ones you might string together, then open the list on your stand.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <div className="seg" role="group" aria-label="Major or minor">
              {MODES.map((m) => (
                <button key={m.label} type="button" aria-pressed={medley.mode === m.value} onClick={() => set({ mode: m.value })}>
                  {m.label}
                </button>
              ))}
            </div>
            <div className="seg" role="group" aria-label="Recall">
              {RECALLS.map((r) => (
                <button key={r.label} type="button" aria-pressed={medley.recall === r.value} onClick={() => set({ recall: r.value })}>
                  {r.label}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-line bg-card p-3 shadow-card">
          <Piano
            label="Piano keys. Press one to choose the medley key."
            selected={medley.pc}
            counts={counts}
            describe={(pc) => `${PITCH_NAMES[pc]}, ${counts[pc]} ${counts[pc] === 1 ? 'song' : 'songs'}`}
            onPress={(pc) => {
              // A new key starts a new shortlist.
              onMedley({ ...EMPTY_MEDLEY, mode: medley.mode, recall: medley.recall, pc: medley.pc === pc ? null : pc })
              if (medley.pc !== pc) playKey(pc, medley.mode)
            }}
          />
        </div>
      </div>

      {medley.pc === null ? (
        <p className="rounded-2xl border border-line bg-card px-4 py-10 text-center text-ink-2 shadow-card">
          <span className="block font-display text-3xl text-ink italic">Attacca</span>
          Press a key on the piano to begin.
        </p>
      ) : (
        <>
          <div className="hue flex flex-wrap items-center gap-2 rounded-2xl bg-(--key-tint) px-4 py-3" style={hueStyle(medley.pc)}>
            <p className="mr-auto" role="status">
              <strong className="font-display text-4xl leading-none font-normal">{keyName}</strong>{' '}
              <span className="text-sm">
                {list.length} {list.length === 1 ? 'song' : 'songs'}
                {pinned.length > 0 && `, ${pinned.length} starred`}
              </span>
            </p>
            <button className="btn" disabled={list.length < 2} onClick={shuffle}>
              Shuffle
            </button>
            <button className="btn btn-primary" disabled={list.length === 0} onClick={() => setOnStand(true)}>
              Open on Stand
            </button>
          </div>

          {pinned.length > 0 &&
            (naming ? (
              <form onSubmit={saveSet} className="flex flex-wrap items-center gap-2">
                <input className="field max-w-xs" aria-label="Set name" autoFocus value={name} onChange={(e) => setName(e.target.value)} />
                <button className="btn btn-primary" disabled={!name.trim()}>
                  Save Set
                </button>
                <button type="button" className="btn" onClick={() => setNaming(false)}>
                  Cancel
                </button>
              </form>
            ) : (
              <div className="flex flex-wrap gap-2">
                <button
                  className="btn"
                  onClick={() => {
                    setName(`${keyName} medley`)
                    setNaming(true)
                  }}
                >
                  Save {pinned.length} Starred as a Set
                </button>
                <button className="btn" onClick={() => set({ pins: [] })}>
                  Clear Stars
                </button>
              </div>
            ))}

          {list.length === 0 ? (
            <p className="rounded-2xl border border-line bg-card px-4 py-8 text-center text-ink-2 shadow-card">No songs in {keyName} with these choices.</p>
          ) : (
            <ul aria-label={`Songs in ${keyName}`} className="overflow-hidden rounded-2xl border border-line bg-card shadow-card">
              {list.map((song) => {
                const isPinned = medley.pins.includes(song.id)
                return (
                  <li key={song.id} className="border-b border-line last:border-b-0">
                    <button
                      aria-pressed={isPinned}
                      aria-label={`${song.title}${isPinned ? ', starred. Remove star' : '. Star'}`}
                      onClick={() => togglePin(song.id)}
                      className={`flex min-h-14 w-full items-center gap-3 px-4 py-2 text-left hover:bg-bg ${isPinned ? 'bg-felt-soft hover:bg-felt-soft' : ''}`}
                    >
                      <span className={`text-xl ${isPinned ? 'text-felt' : 'text-ink-2'}`}>
                        <Star filled={isPinned} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-display text-3xl leading-tight">{song.title}</span>
                        {song.artist && <span className="block text-sm text-ink-2">{song.artist}</span>}
                      </span>
                      {song.recall && <RecallTag recall={song.recall} />}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </>
      )}

      {onStand && medley.pc !== null && (
        <StandView
          title={keyName}
          subtitle={`${list.length} ${list.length === 1 ? 'song' : 'songs'}. Tap a title to star it.`}
          songs={list}
          pins={medley.pins}
          onTogglePin={togglePin}
          onShuffle={list.length > 1 ? shuffle : undefined}
          onClose={() => setOnStand(false)}
        />
      )}
    </div>
  )
}
