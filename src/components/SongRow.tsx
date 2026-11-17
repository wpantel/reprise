import type { ArrangementType, SongPatch } from '../lib/songs'
import type { LibrarySong } from '../lib/useSongs'
import { Dynamics, KeyBadge, KeySelect, RecallSelect, RecallTag } from './controls'

/** Column template shared by the header and every row (desktop only). */
export const ROW_GRID =
  'grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 px-4 md:grid-cols-[minmax(0,1fr)_7rem_8rem_7.5rem_minmax(0,9rem)_6rem]'

const LINK_TEXT: Record<ArrangementType, string> = { musescore: 'MuseScore', pdf: 'PDF', other: 'Link' }

export function SongRow({
  song,
  onPatch,
  onOpen,
}: {
  song: LibrarySong
  onPatch: (patch: SongPatch) => void
  onOpen: () => void
}) {
  const pending = song.pending
  return (
    <li className={`${ROW_GRID} border-b border-line last:border-b-0 hover:bg-bg ${pending ? 'opacity-60' : ''}`}>
      <button
        onClick={onOpen}
        disabled={pending}
        aria-label={`Edit ${song.title}`}
        className="flex min-h-14 min-w-0 items-center gap-3 py-1.5 text-left disabled:opacity-100 md:min-h-11"
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[1.0625rem] md:text-sm md:font-medium">{song.title}</span>
          {(song.artist || pending) && (
            <span className="block truncate text-sm text-ink-2 md:text-xs">{pending ? 'Saving…' : song.artist}</span>
          )}
        </span>
        {/* Phone: key and recall at a glance. Editing happens in the detail panel. */}
        <span className="flex shrink-0 flex-col items-end gap-0.5 md:hidden">
          <KeyBadge song={song} />
          {song.recall && <RecallTag recall={song.recall} />}
        </span>
      </button>

      <div className="hidden md:block">
        <KeySelect song={song} label={`Key for ${song.title}`} disabled={pending} onChange={onPatch} />
      </div>
      <div className="hidden md:block">
        <RecallSelect value={song.recall} label={`Recall for ${song.title}`} variant="inline" disabled={pending} onChange={onPatch} />
      </div>
      <div className="hidden md:block">
        <Dynamics value={song.confidence} title={song.title} size="sm" disabled={pending} onChange={onPatch} />
      </div>
      <div className="hidden gap-1 overflow-hidden md:flex">
        {song.tags.map((t) => (
          <span key={t} className="shrink-0 rounded-full bg-surface px-2 py-0.5 text-xs text-ink-2">
            {t}
          </span>
        ))}
      </div>

      {song.arrangement_url && song.arrangement_type ? (
        <a
          href={song.arrangement_url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Open ${LINK_TEXT[song.arrangement_type]} for ${song.title} in a new tab`}
          className="inline-flex min-h-11 min-w-11 items-center justify-center gap-1 text-sm font-medium text-accent hover:underline md:min-h-7 md:justify-start"
        >
          <span className="hidden md:inline">{LINK_TEXT[song.arrangement_type]}</span>
          <svg aria-hidden="true" viewBox="0 0 16 16" className="h-5 w-5 md:h-3.5 md:w-3.5" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 3H3v10h10v-3M9 3h4v4M13 3 7.5 8.5" />
          </svg>
        </a>
      ) : (
        <span />
      )}
    </li>
  )
}
