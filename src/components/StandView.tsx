import { useEffect, useState } from 'react'
import type { Song } from '../lib/songs'
import { KeyBadge } from './controls'
import { Modal } from './Modal'

export function Star({ filled }: { filled: boolean }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" className="h-[1em] w-[1em] shrink-0" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round">
      <path d="m8 1.8 1.9 3.9 4.3.6-3.1 3 .7 4.3L8 11.6l-3.8 2 .7-4.3-3.1-3 4.3-.6z" />
    </svg>
  )
}

/**
 * Song titles in large type, filling the screen, for reading from the music stand.
 * Keeps the screen awake while open where the browser allows it.
 */
export function StandView({
  title,
  subtitle,
  songs,
  numbered,
  showKeys,
  pins,
  onTogglePin,
  onShuffle,
  onClose,
}: {
  title: string
  subtitle: string
  songs: Song[]
  numbered?: boolean
  showKeys?: boolean
  pins?: string[]
  onTogglePin?: (id: string) => void
  onShuffle?: () => void
  onClose: () => void
}) {
  const [isFullscreen, setIsFullscreen] = useState(false)

  useEffect(() => {
    let lock: WakeLockSentinel | undefined
    navigator.wakeLock?.request('screen').then(
      (l) => (lock = l),
      () => {},
    )
    const onChange = () => setIsFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', onChange)
    return () => {
      void lock?.release()
      document.removeEventListener('fullscreenchange', onChange)
      if (document.fullscreenElement) void document.exitFullscreen()
    }
  }, [])

  const toggleFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen()
    else document.documentElement.requestFullscreen().catch(() => {})
  }

  return (
    <Modal label={title} shape="full" onClose={onClose}>
      <div className="sticky top-0 z-10 flex flex-wrap items-center gap-2 border-b border-line bg-card px-4 py-3 md:px-8">
        <div className="mr-auto min-w-0">
          <h2 className="truncate font-display text-4xl leading-none md:text-5xl">{title}</h2>
          <p className="text-sm text-ink-2">{subtitle}</p>
        </div>
        {onShuffle && (
          <button className="btn" onClick={onShuffle}>
            Shuffle
          </button>
        )}
        {'requestFullscreen' in document.documentElement && (
          <button className="btn hidden md:inline-flex" onClick={toggleFullscreen}>
            {isFullscreen ? 'Exit Full Screen' : 'Full Screen'}
          </button>
        )}
        <button className="btn btn-primary" onClick={onClose}>
          Done
        </button>
      </div>

      <ol className="flex-1 gap-x-12 px-4 py-4 md:columns-2 md:px-8 md:py-6">
        {songs.map((song, i) => {
          const pinned = pins?.includes(song.id) ?? false
          const line = (
            <>
              {numbered && <span className="w-[1.6em] shrink-0 text-right text-ink-2 tabular-nums">{i + 1}</span>}
              {onTogglePin && (
                <span className={`text-[0.6em] ${pinned ? 'text-felt' : 'text-line'}`}>
                  <Star filled={pinned} />
                </span>
              )}
              <span className="min-w-0 flex-1">{song.title}</span>
              {showKeys && (
                <span className="shrink-0 font-sans">
                  <KeyBadge song={song} />
                </span>
              )}
            </>
          )
          const lineClass = 'flex w-full items-center gap-[0.4em] py-[0.2em] text-left font-display text-[clamp(1.875rem,4.6vw,3.75rem)] leading-[1.1]'
          return (
            <li key={song.id} className="break-inside-avoid border-b border-line">
              {onTogglePin ? (
                <button className={lineClass} aria-pressed={pinned} aria-label={`${song.title}${pinned ? ', pinned. Unpin' : '. Pin'}`} onClick={() => onTogglePin(song.id)}>
                  {line}
                </button>
              ) : (
                <div className={lineClass}>{line}</div>
              )}
            </li>
          )
        })}
      </ol>
    </Modal>
  )
}
