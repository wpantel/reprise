import type { SupabaseClient } from '@supabase/supabase-js'
import type { NewSong, Song, SongPatch } from './songs'

export interface SongStore {
  list(): Promise<Song[]>
  insert(songs: NewSong[]): Promise<Song[]>
  update(id: string, patch: SongPatch): Promise<Song>
  remove(id: string): Promise<void>
}

const COLUMNS =
  'id,title,artist,key_tonic,key_mode,recall,confidence,arrangement_url,arrangement_type,tags,created_at'

export function supabaseStore(client: SupabaseClient): SongStore {
  return {
    async list() {
      const { data, error } = await client.from('songs').select(COLUMNS)
      if (error) throw error
      return data as Song[]
    },
    async insert(songs) {
      const rows = songs.map((s) => ({ title: s.title, artist: s.artist ?? null }))
      const { data, error } = await client.from('songs').insert(rows).select(COLUMNS)
      if (error) throw error
      return data as Song[]
    },
    async update(id, patch) {
      const { data, error } = await client.from('songs').update(patch).eq('id', id).select(COLUMNS).single()
      if (error) throw error
      return data as Song
    },
    async remove(id) {
      const { error } = await client.from('songs').delete().eq('id', id)
      if (error) throw error
    },
  }
}

const LOCAL_KEY = 'repertoire.songs.v1'
const read = (): Song[] => JSON.parse(localStorage.getItem(LOCAL_KEY) ?? '[]')
const write = (songs: Song[]) => localStorage.setItem(LOCAL_KEY, JSON.stringify(songs))

/** Browser-only storage, used when Supabase isn't configured. */
export const localStore: SongStore = {
  async list() {
    return read()
  },
  async insert(songs) {
    const now = Date.now()
    const created: Song[] = songs.map((s, i) => ({
      id: crypto.randomUUID(),
      title: s.title,
      artist: s.artist ?? null,
      key_tonic: null,
      key_mode: null,
      recall: null,
      confidence: null,
      arrangement_url: null,
      arrangement_type: null,
      tags: [],
      created_at: new Date(now + i).toISOString(),
    }))
    write([...read(), ...created])
    return created
  },
  async update(id, patch) {
    const songs = read()
    const i = songs.findIndex((s) => s.id === id)
    if (i < 0) throw new Error('Song not found')
    songs[i] = { ...songs[i], ...patch }
    write(songs)
    return songs[i]
  },
  async remove(id) {
    write(read().filter((s) => s.id !== id))
  },
}
