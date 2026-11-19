import { useCallback, useEffect, useRef, useState } from 'react'
import type { NewSong, Play, SetPatch, Song, SongPatch, SongSet } from './songs'
import { isNetworkError, isQueued, newQueuedPlay, type OfflineCache } from './offline'
import type { SongStore } from './store'

/** A song as shown in the library; `pending` until its first save completes. */
export type LibrarySong = Song & { pending?: boolean }

export interface SyncOptions {
  /** The device copy of this account's library; omitted in local mode, where everything is on the device already. */
  cache?: OfflineCache
  /** False while the sign-in can't be confirmed (no connection): show the device copy and don't call the store. */
  canSync?: boolean
}

export function useSongs(store: SongStore, onError: (message: string) => void, { cache, canSync = true }: SyncOptions = {}) {
  const [songs, setSongs] = useState<LibrarySong[]>([])
  const [plays, setPlays] = useState<Play[]>([])
  const [sets, setSets] = useState<SongSet[]>([])
  const setsRef = useRef(sets)
  setsRef.current = sets
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const statusRef = useRef(status)
  statusRef.current = status
  const songsRef = useRef(songs)
  songsRef.current = songs
  /** When the device copy on screen was loaded from the store; null once fresh data has come in. */
  const [deviceCopyAt, setDeviceCopyAt] = useState<string | null>(null)
  /** The store couldn't be reached the last time it was tried, or the browser reports no connection. */
  const [unreachable, setUnreachable] = useState(false)
  const [queuedCount, setQueuedCount] = useState(() => cache?.readQueue().length ?? 0)
  const flushing = useRef(false)

  /** Sends plays logged offline, oldest first, and stops at the first one that can't reach the server. */
  const flush = useCallback(async () => {
    if (!cache || flushing.current) return
    flushing.current = true
    try {
      for (const q of cache.readQueue()) {
        try {
          const saved = await store.addPlay(q.song_id, q.felt_rusty, q.played_at)
          cache.dequeue(q.id)
          setPlays((cur) => cur.map((p) => (p.id === q.id ? saved : p)))
        } catch (e) {
          if (isNetworkError(e)) {
            setUnreachable(true)
            break
          }
          // The server refused it (the song was deleted on another device, say): drop it.
          cache.dequeue(q.id)
          setPlays((cur) => cur.filter((p) => p.id !== q.id))
          const title = songsRef.current.find((s) => s.id === q.song_id)?.title
          onError(title ? `Couldn’t save an offline play of “${title}”.` : 'Couldn’t save a play logged offline.')
        }
      }
    } finally {
      flushing.current = false
      setQueuedCount(cache.readQueue().length)
    }
  }, [cache, store, onError])

  const load = useCallback(() => {
    // Open the device copy straight away, then refresh it in the background.
    const snapshot = statusRef.current === 'ready' ? null : (cache?.readSnapshot() ?? null)
    const queued = cache?.readQueue() ?? []
    if (snapshot) {
      setSongs(snapshot.songs)
      setPlays([...snapshot.plays, ...queued])
      setSets(snapshot.sets)
      setDeviceCopyAt(snapshot.savedAt)
      setStatus('ready')
    }
    const onScreen = statusRef.current === 'ready' || snapshot !== null
    if (!canSync) {
      setUnreachable(true)
      if (!onScreen) setStatus('error')
      return
    }
    if (!onScreen) setStatus('loading')
    Promise.all([store.list(), store.listPlays(), store.listSets()]).then(
      ([list, history, savedSets]) => {
        setSongs(list)
        // Plays still waiting to be sent stay on screen until they are.
        setPlays([...history, ...(cache?.readQueue() ?? [])])
        setSets(savedSets)
        setDeviceCopyAt(null)
        setUnreachable(false)
        setStatus('ready')
        void flush()
      },
      (e) => {
        if (!onScreen) setStatus('error')
        else if (isNetworkError(e)) setUnreachable(true)
        else onError('Couldn’t refresh your library, so you may be seeing an older copy. Try reloading.')
      },
    )
  }, [store, cache, canSync, flush, onError])
  useEffect(load, [load])

  // Back online: refresh, which also sends any queued plays.
  useEffect(() => {
    const offline = () => setUnreachable(true)
    window.addEventListener('online', load)
    window.addEventListener('offline', offline)
    return () => {
      window.removeEventListener('online', load)
      window.removeEventListener('offline', offline)
    }
  }, [load])

  // Keep the device copy current with what the store has confirmed.
  useEffect(() => {
    if (cache && status === 'ready' && deviceCopyAt === null) cache.writeSnapshot(songs, plays, sets)
  }, [cache, status, deviceCopyAt, songs, plays, sets])

  /** Reports a change that couldn't be saved, saying so plainly when it's because there's no connection. */
  const failed = useCallback(
    (e: unknown, message: string) =>
      onError(
        cache && isNetworkError(e)
          ? `${message} You’re offline: plays still save and sync later, but other changes need a connection.`
          : `${message} Check your connection and try again.`,
      ),
    [cache, onError],
  )

  /** Shows the songs immediately, then saves. Rejects (and removes them) if the save fails. */
  const add = useCallback(
    async (drafts: NewSong[]): Promise<Song[]> => {
      const now = Date.now()
      const temp: LibrarySong[] = drafts.map((d, i) => ({
        id: `pending-${now}-${i}-${Math.random().toString(36).slice(2)}`,
        title: d.title,
        artist: d.artist ?? null,
        key_tonic: d.key_tonic ?? null,
        key_mode: d.key_mode ?? null,
        recall: null,
        confidence: d.confidence ?? null,
        arrangement_url: null,
        arrangement_type: null,
        tags: [],
        created_at: new Date(now + i).toISOString(),
        pending: true,
      }))
      const tempIds = new Set(temp.map((t) => t.id))
      setSongs((cur) => [...cur, ...temp])
      try {
        const saved = await store.insert(drafts)
        setSongs((cur) => [...cur.filter((s) => !tempIds.has(s.id)), ...saved])
        return saved
      } catch (e) {
        setSongs((cur) => cur.filter((s) => !tempIds.has(s.id)))
        throw e
      }
    },
    [store],
  )

  const update = useCallback(
    async (id: string, patch: SongPatch) => {
      const before = songsRef.current.find((s) => s.id === id)
      if (!before || before.pending) return
      setSongs((cur) => cur.map((s) => (s.id === id ? { ...s, ...patch } : s)))
      try {
        await store.update(id, patch)
      } catch (e) {
        // Put back only the fields this edit touched, so later edits survive.
        const undo = Object.fromEntries(Object.keys(patch).map((k) => [k, before[k as keyof Song]]))
        setSongs((cur) => cur.map((s) => (s.id === id ? { ...s, ...undo } : s)))
        failed(e, `Couldn’t save the change to “${before.title}”.`)
      }
    },
    [store, failed],
  )

  const remove = useCallback(
    async (id: string) => {
      const before = songsRef.current.find((s) => s.id === id)
      if (!before) return
      setSongs((cur) => cur.filter((s) => s.id !== id))
      try {
        await store.remove(id)
        setPlays((cur) => cur.filter((p) => p.song_id !== id))
      } catch (e) {
        setSongs((cur) => [...cur, before])
        failed(e, `Couldn’t delete “${before.title}”.`)
      }
    },
    [store, failed],
  )

  /**
   * Records that a song was played now. Without a connection the play is kept on the device and sent later.
   * Resolves to the play (saved or queued), or null if it couldn't be recorded.
   */
  const logPlay = useCallback(
    async (songId: string, feltRusty: boolean): Promise<Play | null> => {
      const playedAt = new Date().toISOString()
      const queue = () => {
        const queued = newQueuedPlay(songId, feltRusty, playedAt)
        cache!.enqueue(queued)
        setQueuedCount(cache!.readQueue().length)
        return queued
      }
      if (cache && (!canSync || !navigator.onLine)) {
        const queued = queue()
        setPlays((cur) => [...cur, queued])
        return queued
      }
      const temp: Play = { id: `pending-${Date.now()}`, song_id: songId, played_at: playedAt, felt_rusty: feltRusty }
      setPlays((cur) => [...cur, temp])
      try {
        const saved = await store.addPlay(songId, feltRusty, playedAt)
        setPlays((cur) => cur.map((p) => (p.id === temp.id ? saved : p)))
        return saved
      } catch (e) {
        if (cache && isNetworkError(e)) {
          const queued = queue()
          setPlays((cur) => cur.map((p) => (p.id === temp.id ? queued : p)))
          return queued
        }
        setPlays((cur) => cur.filter((p) => p.id !== temp.id))
        failed(e, 'Couldn’t save that play.')
        return null
      }
    },
    [store, cache, canSync, failed],
  )

  const removePlay = useCallback(
    async (play: Play) => {
      setPlays((cur) => cur.filter((p) => p.id !== play.id))
      if (isQueued(play.id)) {
        // Never left the device: nothing to undo on the server.
        cache?.dequeue(play.id)
        setQueuedCount(cache?.readQueue().length ?? 0)
        return
      }
      try {
        await store.removePlay(play.id)
      } catch (e) {
        setPlays((cur) => [...cur, play])
        failed(e, 'Couldn’t undo that play.')
      }
    },
    [store, cache, failed],
  )

  /** Saves a new set. Resolves to it, or null if it couldn't be saved. */
  const createSet = useCallback(
    async (name: string, songIds: string[]): Promise<SongSet | null> => {
      try {
        const saved = await store.createSet(name, songIds)
        setSets((cur) => [...cur, saved])
        return saved
      } catch (e) {
        failed(e, `Couldn’t save the set “${name}”.`)
        return null
      }
    },
    [store, failed],
  )

  const updateSet = useCallback(
    async (id: string, patch: SetPatch) => {
      const before = setsRef.current.find((s) => s.id === id)
      if (!before) return
      setSets((cur) => cur.map((s) => (s.id === id ? { ...s, ...patch } : s)))
      try {
        await store.updateSet(id, patch)
      } catch (e) {
        setSets((cur) => cur.map((s) => (s.id === id ? before : s)))
        failed(e, `Couldn’t save the change to “${before.name}”.`)
      }
    },
    [store, failed],
  )

  const removeSet = useCallback(
    async (id: string) => {
      const before = setsRef.current.find((s) => s.id === id)
      if (!before) return
      setSets((cur) => cur.filter((s) => s.id !== id))
      try {
        await store.removeSet(id)
      } catch (e) {
        setSets((cur) => [...cur, before])
        failed(e, `Couldn’t delete “${before.name}”.`)
      }
    },
    [store, failed],
  )

  return { songs, plays, sets, status, reload: load, add, update, remove, logPlay, removePlay, createSet, updateSet, removeSet,
    /** Only with a device cache: whether the store is out of reach, and when the library on screen was last loaded from it (null if this visit). */
    offline: Boolean(cache) && unreachable,
    offlineSince: deviceCopyAt,
    queuedCount,
  }
}
