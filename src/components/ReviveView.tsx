import { useState } from 'react'
import { agoLabel, CONFIDENT_FROM, REVIVE_AFTER_DAYS, reviveGroups, RUSTY_AFTER_DAYS, type DueSong } from '../lib/history'
import { DYNAMICS, type Play, type Song } from '../lib/songs'
import { KeyBadge, RecallTag, SongLabel } from './controls'

const UNPLAYED_PREVIEW = 6

function ReviveCard({
  song,
  note,
  onOpen,
  onPlayed,
}: {
  song: Song
  note: string
  onOpen: () => void
  onPlayed: (feltRusty: boolean) => void
}) {
  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line px-4 py-1.5 last:border-b-0 hover:bg-bg">
      <button
        onClick={onOpen}
        aria-label={`Edit ${song.title}`}
        className="flex min-h-14 min-w-0 flex-1 basis-full items-center gap-3 text-left md:min-h-11 md:basis-56"
      >
        <SongLabel
          title={song.title}
          subtitle={
            <>
              {song.artist && `${song.artist} · `}
              {note}
              {song.confidence && (
                <>
                  {' · '}
                  <i className="font-display text-ink">{DYNAMICS[song.confidence - 1]}</i>
                </>
              )}
            </>
          }
        />
        <span className="flex shrink-0 flex-col items-end gap-0.5">
          <KeyBadge song={song} />
          {song.recall && <RecallTag recall={song.recall} />}
        </span>
      </button>
      <div className="flex gap-2">
        {song.arrangement_url && (
          <a className="btn" href={song.arrangement_url} target="_blank" rel="noopener noreferrer" aria-label={`Open the score for ${song.title} in a new tab`}>
            Score
          </a>
        )}
        <button className="btn" onClick={() => onPlayed(true)} aria-label={`${song.title}: played, felt rusty`}>
          Felt Rusty
        </button>
        <button className="btn btn-primary" onClick={() => onPlayed(false)} aria-label={`Mark ${song.title} as played`}>
          Played
        </button>
      </div>
    </li>
  )
}

const dueNote = (d: DueSong<Song>) => `Played ${agoLabel(d.days)}${d.last.felt_rusty ? ', felt rusty' : ''}`

/** Songs worth coming back to, and songs with no play history yet. */
export function ReviveView({
  songs,
  plays,
  onOpen,
  onPlayed,
}: {
  songs: Song[]
  plays: Play[]
  onOpen: (song: Song) => void
  onPlayed: (song: Song, feltRusty: boolean) => void
}) {
  const [showAll, setShowAll] = useState(false)
  const { due, unplayed } = reviveGroups(songs, plays, new Date())
  const shownUnplayed = showAll ? unplayed : unplayed.slice(0, UNPLAYED_PREVIEW)

  return (
    <div className="flex flex-col gap-6">
      <section aria-labelledby="due-heading" className="flex flex-col gap-3">
        <div>
          <h2 id="due-heading" className="font-display text-4xl leading-tight">
            Due for a reprise <span className="text-ink-2">{due.length}</span>
          </h2>
          <p className="text-sm text-ink-2">
            Songs rated <i className="font-display text-base">{DYNAMICS[CONFIDENT_FROM - 1]}</i> or{' '}
            <i className="font-display text-base">{DYNAMICS[CONFIDENT_FROM]}</i> that you haven’t played for {REVIVE_AFTER_DAYS} days, and any song that felt
            rusty {RUSTY_AFTER_DAYS} or more days ago.
          </p>
        </div>
        {due.length > 0 ? (
          <ul className="overflow-hidden rounded-2xl border border-line bg-card shadow-card">
            {due.map((d) => (
              <ReviveCard key={d.song.id} song={d.song} note={dueNote(d)} onOpen={() => onOpen(d.song)} onPlayed={(rusty) => onPlayed(d.song, rusty)} />
            ))}
          </ul>
        ) : (
          <p className="rounded-2xl border border-line bg-card px-4 py-8 text-center text-ink-2 shadow-card">
            <span className="block font-display text-3xl text-ink italic">Al fine</span>
            Nothing is due. Songs appear here once you’ve marked them as played and time has passed.
          </p>
        )}
      </section>

      {unplayed.length > 0 && (
        <section aria-labelledby="unplayed-heading" className="flex flex-col gap-3">
          <div>
            <h2 id="unplayed-heading" className="font-display text-3xl leading-tight">
              Unplayed since import <span className="text-ink-2">{unplayed.length}</span>
            </h2>
            <p className="text-sm text-ink-2">No play history yet. Mark one as played the next time you play it.</p>
          </div>
          <ul className="overflow-hidden rounded-2xl border border-line bg-card shadow-card">
            {shownUnplayed.map((song) => (
              <ReviveCard key={song.id} song={song} note="Not played yet" onOpen={() => onOpen(song)} onPlayed={(rusty) => onPlayed(song, rusty)} />
            ))}
          </ul>
          {unplayed.length > UNPLAYED_PREVIEW && (
            <button className="btn self-start" onClick={() => setShowAll(!showAll)}>
              {showAll ? 'Show Fewer' : `Show All ${unplayed.length}`}
            </button>
          )}
        </section>
      )}
    </div>
  )
}
