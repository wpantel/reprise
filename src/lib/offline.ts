import { normalizeSong, type Play, type Song, type SongSet } from './songs'

/** The library as last loaded from Supabase, kept on the device so the app opens without a connection. */
export interface Snapshot {
  songs: Song[]
  plays: Play[]
  sets: SongSet[]
  /** When this copy was loaded from Supabase. */
  savedAt: string
}

/** A play logged without a connection, waiting to be saved. Its id starts with `queued-`. */
export type QueuedPlay = Play

export const isQueued = (id: string) => id.startsWith('queued-')
const isTemp = (id: string) => id.startsWith('pending-') || isQueued(id)

export const newQueuedPlay = (songId: string, feltRusty: boolean, playedAt = new Date().toISOString()): QueuedPlay => ({
  id: `queued-${crypto.randomUUID()}`,
  song_id: songId,
  played_at: playedAt,
  felt_rusty: feltRusty,
})

/** True when a failed request looks like no connection rather than a refusal from the server. */
export function isNetworkError(e: unknown, online = typeof navigator === 'undefined' ? true : navigator.onLine): boolean {
  if (!online) return true
  if (e instanceof TypeError) return true
  const message = e instanceof Error ? e.message : typeof e === 'object' && e && 'message' in e ? String(e.message) : ''
  // Chrome: "Failed to fetch"; Safari: "Load failed"; Firefox: "NetworkError when attempting to fetch resource."
  return /failed to fetch|load failed|networkerror|network request failed/i.test(message)
}

/** Browser storage, or nothing where it is blocked (private windows, some previews). */
function deviceStorage(): Storage | undefined {
  try {
    return typeof localStorage === 'undefined' ? undefined : localStorage
  } catch {
    return undefined
  }
}

function readJson<T>(storage: Storage | undefined, key: string): T | null {
  try {
    const raw = storage?.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

function writeJson(storage: Storage | undefined, key: string, value: unknown) {
  try {
    storage?.setItem(key, JSON.stringify(value))
  } catch {
    // Full or blocked storage: the app still works online, it just can't open offline.
  }
}

/** The device copy of one account's library and its unsent plays. */
export function offlineCache(userId: string, storage: Storage | undefined = deviceStorage()) {
  const snapshotKey = `reprise.snapshot.v1.${userId}`
  const queueKey = `reprise.queuedPlays.v1.${userId}`
  return {
    readSnapshot(): Snapshot | null {
      const snap = readJson<Snapshot>(storage, snapshotKey)
      return snap && { ...snap, songs: snap.songs.map(normalizeSong) }
    },
    /** Saves what was loaded from Supabase, leaving out anything not saved there yet. */
    writeSnapshot(songs: (Song & { pending?: boolean })[], plays: Play[], sets: SongSet[], savedAt = new Date().toISOString()) {
      const snapshot: Snapshot = {
        songs: songs.filter((s) => !s.pending && !isTemp(s.id)).map(({ pending: _, ...s }) => s),
        plays: plays.filter((p) => !isTemp(p.id)),
        sets,
        savedAt,
      }
      writeJson(storage, snapshotKey, snapshot)
    },
    clearSnapshot() {
      try {
        storage?.removeItem(snapshotKey)
      } catch {
        // Nothing to clear.
      }
    },
    readQueue: () => readJson<QueuedPlay[]>(storage, queueKey) ?? [],
    enqueue(play: QueuedPlay) {
      writeJson(storage, queueKey, [...this.readQueue(), play])
    },
    dequeue(id: string) {
      writeJson(storage, queueKey, this.readQueue().filter((p) => p.id !== id))
    },
  }
}
export type OfflineCache = ReturnType<typeof offlineCache>

/** The account last signed in on this device, so the app can open its copy before the session is confirmed. */
const LAST_USER_KEY = 'reprise.lastUser.v1'
export const readLastUser = (storage = deviceStorage()) => readJson<string>(storage, LAST_USER_KEY)
export const writeLastUser = (userId: string | null, storage = deviceStorage()) => {
  if (userId) writeJson(storage, LAST_USER_KEY, userId)
  else {
    try {
      storage?.removeItem(LAST_USER_KEY)
    } catch {
      // Nothing to clear.
    }
  }
}
