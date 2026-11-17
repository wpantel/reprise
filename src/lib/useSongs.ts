import { useCallback, useEffect, useRef, useState } from 'react'
import type { NewSong, Song, SongPatch } from './songs'
import type { SongStore } from './store'

/** A song as shown in the library; `pending` until its first save completes. */
export type LibrarySong = Song & { pending?: boolean }

export function useSongs(store: SongStore, onError: (message: string) => void) {
  const [songs, setSongs] = useState<LibrarySong[]>([])
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const songsRef = useRef(songs)
  songsRef.current = songs

  const load = useCallback(() => {
    setStatus('loading')
    store.list().then(
      (list) => {
        setSongs(list)
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
      } catch {
        setSongs((cur) => [...cur, before])
        onError(`Couldn’t delete “${before.title}”. Check your connection and try again.`)
      }
    },
    [store, onError],
  )

  return { songs, status, reload: load, add, update, remove }
}
