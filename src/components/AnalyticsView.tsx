import type { ReactNode } from 'react'
import { NO_SCORE, NONE, type Filters } from '../lib/filters'
import { analytics, RECENT_DAYS } from '../lib/history'
import { parseKeyId, pitchClass, RECALLS, type Play, type Recall, type Song } from '../lib/songs'
import { KeyBadge, RecallIcon } from './controls'
import { hueStyle } from './Piano'

const pct = (n: number, total: number) => (total ? Math.round((n / total) * 100) : 0)
const songsWord = (n: number) => (n === 1 ? 'song' : 'songs')

/** A headline number. The whole tile opens the songs behind it. */
function Tile({ value, label, detail, onClick, children }: { value: ReactNode; label: string; detail?: string; onClick: () => void; children?: ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-start gap-1 rounded-2xl border border-line bg-card p-4 text-left shadow-card hover:border-ink-2"
    >
      <span className="text-sm font-medium text-ink-2">{label}</span>
      <span className="font-display text-6xl leading-none">{value}</span>
      {detail && <span className="text-sm text-ink-2">{detail}</span>}
      {children}
    </button>
  )
}

/** One labelled bar. The whole row is the click target, not just the bar. */
function BarRow({
  label,
  count,
  max,
  barClass,
  barStyle,
  title,
  onClick,
}: {
  label: ReactNode
  count: number
  max: number
  barClass: string
  barStyle?: React.CSSProperties
  title: string
  onClick: () => void
}) {
  return (
    <li>
      <button
        onClick={onClick}
        title={title}
        aria-label={title}
        className="grid min-h-11 w-full grid-cols-[7rem_minmax(0,1fr)_2.5rem] items-center gap-3 rounded-lg px-2 text-left hover:bg-bg md:min-h-9"
      >
        <span className="flex items-center gap-1.5 text-sm">{label}</span>
        <span className="block h-3">
          {count > 0 && <span className={`block h-full rounded-r-[4px] ${barClass}`} style={{ ...barStyle, width: `max(4px, ${(count / max) * 100}%)` }} />}
        </span>
        <span className="text-right text-sm font-semibold tabular-nums">{count}</span>
      </button>
    </li>
  )
}

/** Totals for the library. Every number opens the matching list. */
export function AnalyticsView({ songs, plays, onShow }: { songs: Song[]; plays: Play[]; onShow: (filters: Partial<Filters>) => void }) {
  const a = analytics(songs, plays, new Date())
  const maxKey = Math.max(1, a.noKey, ...a.byKey.map((k) => k.count))
  const recallRows: { value: Recall | typeof NONE; label: string; count: number }[] = [
    ...RECALLS.map((r) => ({ value: r.value, label: r.label, count: a.byRecall[r.value] })),
    { value: NONE, label: 'Not set', count: a.byRecall.none },
  ]
  const maxRecall = Math.max(1, ...recallRows.map((r) => r.count))

  if (a.total === 0) {
    return <p className="rounded-2xl border border-line bg-card px-4 py-10 text-center text-ink-2 shadow-card">Add some songs and the numbers will appear here.</p>
  }

  return (
    <div className="flex flex-col gap-4">
      <h2 className="sr-only">Analytics</h2>
      <div className="grid gap-4 md:grid-cols-3">
        <Tile label="Songs in your repertoire" value={a.total} onClick={() => onShow({})} />
        <Tile
          label="Playable without a score"
          value={a.withoutScore}
          detail={`${pct(a.withoutScore, a.total)}% of your songs, memorized or by ear`}
          onClick={() => onShow({ recall: NO_SCORE })}
        />
        <Tile
          label={`Played in the last ${RECENT_DAYS} days`}
          value={
            <>
              {a.playedRecently}
              <span className="text-3xl text-ink-2"> of {a.total}</span>
            </>
          }
          onClick={() => onShow({ played: 'recent' })}
        >
          <span
            role="meter"
            aria-label={`Share of repertoire played in the last ${RECENT_DAYS} days`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={pct(a.playedRecently, a.total)}
            className="mt-1 block h-2 w-full overflow-hidden rounded-full bg-surface"
          >
            <span className="block h-full rounded-full bg-accent" style={{ width: `${pct(a.playedRecently, a.total)}%` }} />
          </span>
          <span className="text-sm text-ink-2">{pct(a.playedRecently, a.total)}% of your songs</span>
        </Tile>
      </div>

      {a.total - a.playedRecently > 0 && (
        <button className="btn self-start" onClick={() => onShow({ played: 'stale' })}>
          Show the {a.total - a.playedRecently} not played in {RECENT_DAYS} days
        </button>
      )}

      <div className="grid gap-4 md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <section aria-labelledby="by-key" className="rounded-2xl border border-line bg-card p-4 shadow-card">
          <h3 id="by-key" className="font-display text-3xl leading-tight">
            Songs by key
          </h3>
          <p className="mb-2 text-sm text-ink-2">Solid bars are major keys, outlined bars are minor.</p>
          <ul>
            {a.byKey.map(({ id, count }) => {
              const key = parseKeyId(id)
              const pc = pitchClass(key.key_tonic!)
              return (
                <BarRow
                  key={id}
                  label={<KeyBadge song={key} />}
                  count={count}
                  max={maxKey}
                  barClass={key.key_mode === 'major' ? 'hue bg-(--key-solid)' : 'hue border-2 border-l-0 border-(--key-solid) bg-(--key-tint)'}
                  barStyle={hueStyle(pc)}
                  title={`${count} ${songsWord(count)} in ${id.replace(':', ' ').replace('#', '♯').replace('b', '♭')}. Show them`}
                  onClick={() => onShow({ pc, mode: key.key_mode })}
                />
              )
            })}
            {a.noKey > 0 && (
              <BarRow
                label={<KeyBadge song={{ key_tonic: null, key_mode: null }} />}
                count={a.noKey}
                max={maxKey}
                barClass="bg-ink-2"
                title={`${a.noKey} ${songsWord(a.noKey)} with no key. Show them`}
                onClick={() => onShow({ pc: NONE })}
              />
            )}
          </ul>
        </section>

        <section aria-labelledby="by-recall" className="self-start rounded-2xl border border-line bg-card p-4 shadow-card">
          <h3 id="by-recall" className="mb-2 font-display text-3xl leading-tight">
            How you play them
          </h3>
          <ul>
            {recallRows.map((r) => (
              <BarRow
                key={r.value}
                label={
                  <>
                    {r.value !== NONE ? <RecallIcon recall={r.value} /> : <span className="w-4" />}
                    {r.label}
                  </>
                }
                count={r.count}
                max={maxRecall}
                barClass={r.value === NONE ? 'bg-ink-2' : 'bg-accent'}
                title={`${r.count} ${songsWord(r.count)}: ${r.label.toLowerCase()}. Show them`}
                onClick={() => onShow({ recall: r.value })}
              />
            ))}
          </ul>
        </section>
      </div>
    </div>
  )
}
