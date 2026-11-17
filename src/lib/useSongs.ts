import { useCallback, useEffect, useRef, useState } from 'react'
import type { NewSong, Play, Song, SongPatch } from './songs'
import type { SongStore } from './store'

/** A song as shown in the library; `pending` until its first save completes. */
export type LibrarySong = Song & { pending?: boolean }

export function useSongs(store: SongStore, onError: (message: string) => void) {
  const [songs, setSongs] = useState<LibrarySong[]>([])
  const [plays, setPlays] = useState<Play[]>([])
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const songsRef = useRef(songs)
  songsRef.current = songs

  const load = useCallback(() => {
    setStatus('loading')
    Promise.all([store.list(), store.listPlays()]).then(
      ([list, history]) => {
        setSongs(list)
        setPlays(history)
        setStatus('ready')
      },
      () => setStatus('error'),
    )
  }, [store])
  useEffect(load, [load])

  /** Shows the songs immediately, then saves. Rejects (and removes them) if the save fails. */
  const add = useCallback(
    async (drafts: NewSong[]): Promise<Song[]> => {
      const now = Date.now()
      const temp: LibrarySong[] = drafts.map((d, i) => ({
        id: `pending-${now}-${i}-${Math.random().toString(36).slice(2)}`,
        title: d.title,
        artist: d.artist ?? null,
        key_tonic: null,
        key_mode: null,
        recall: null,
        confidence: null,
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
      } catch {
        // Put back only the fields this edit touched, so later edits survive.
        const undo = Object.fromEntries(Object.keys(patch).map((k) => [k, before[k as keyof Song]]))
        setSongs((cur) => cur.map((s) => (s.id === id ? { ...s, ...undo } : s)))
        onError(`Couldn’t save the change to “${before.title}”. Check your connection and try again.`)
      }
    },
    [store, onError],
  )

  const remove = useCallback(
    async (id: string) => {
      const before = songsRef.current.find((s) => s.id === id)
      if (!before) return
      setSongs((cur) => cur.filter((s) => s.id !== id))
      try {
        await store.remove(id)
        setPlays((cur) => cur.filter((p) => p.song_id !== id))
      } catch {
        setSongs((cur) => [...cur, before])
        onError(`Couldn’t delete “${before.title}”. Check your connection and try again.`)
      }
    },
    [store, onError],
  )

  /** Records that a song was played now. Resolves to the saved play, or null if it couldn't be saved. */
  const logPlay = useCallback(
    async (songId: string, feltRusty: boolean): Promise<Play | null> => {
      const temp: Play = { id: `pending-${Date.now()}`, song_id: songId, played_at: new Date().toISOString(), felt_rusty: feltRusty }
      setPlays((cur) => [...cur, temp])
      try {
        const saved = await store.addPlay(songId, feltRusty)
        setPlays((cur) => cur.map((p) => (p.id === temp.id ? saved : p)))
        return saved
      } catch {
        setPlays((cur) => cur.filter((p) => p.id !== temp.id))
        onError('Couldn’t save that play. Check your connection and try again.')
        return null
      }
    },
    [store, onError],
  )

  const removePlay = useCallback(
    async (play: Play) => {
      setPlays((cur) => cur.filter((p) => p.id !== play.id))
      try {
        await store.removePlay(play.id)
      } catch {
        setPlays((cur) => [...cur, play])
        onError('Couldn’t undo that play. Check your connection and try again.')
      }
    },
    [store, onError],
  )

  return { songs, plays, status, reload: load, add, update, remove, logPlay, removePlay }
}
