import type { SupabaseClient } from '@supabase/supabase-js'
import type { NewSong, Play, SetPatch, Song, SongPatch, SongSet } from './songs'

export interface SongStore {
  list(): Promise<Song[]>
  insert(songs: NewSong[]): Promise<Song[]>
  update(id: string, patch: SongPatch): Promise<Song>
  remove(id: string): Promise<void>
  listPlays(): Promise<Play[]>
  addPlay(songId: string, feltRusty: boolean): Promise<Play>
  removePlay(id: string): Promise<void>
  listSets(): Promise<SongSet[]>
  createSet(name: string, songIds: string[]): Promise<SongSet>
  updateSet(id: string, patch: SetPatch): Promise<void>
  removeSet(id: string): Promise<void>
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
    async listPlays() {
      // The API returns at most 1000 rows per request, so read the history in pages.
      const all: Play[] = []
      for (let from = 0; ; from += PAGE) {
        const { data, error } = await client
          .from('plays')
          .select(PLAY_COLUMNS)
          .order('played_at', { ascending: false })
          .order('id')
          .range(from, from + PAGE - 1)
        if (error) throw error
        all.push(...(data as Play[]))
        if (data.length < PAGE) return all
      }
    },
    async addPlay(songId, feltRusty) {
      const { data, error } = await client.from('plays').insert({ song_id: songId, felt_rusty: feltRusty }).select(PLAY_COLUMNS).single()
      if (error) throw error
      return data as Play
    },
    async removePlay(id) {
      const { error } = await client.from('plays').delete().eq('id', id)
      if (error) throw error
    },
    async listSets() {
      const { data, error } = await client.from('sets').select(SET_COLUMNS).order('created_at')
      if (error) throw error
      return data as SongSet[]
    },
    async createSet(name, songIds) {
      const { data, error } = await client.from('sets').insert({ name, song_ids: songIds }).select(SET_COLUMNS).single()
      if (error) throw error
      return data as SongSet
    },
    async updateSet(id, patch) {
      const { error } = await client.from('sets').update(patch).eq('id', id)
      if (error) throw error
    },
    async removeSet(id) {
      const { error } = await client.from('sets').delete().eq('id', id)
      if (error) throw error
    },
  }
}

const PLAY_COLUMNS = 'id,song_id,played_at,felt_rusty'
const SET_COLUMNS = 'id,name,song_ids,created_at'
const PAGE = 1000

const LOCAL_KEY = 'repertoire.songs.v1'
const LOCAL_PLAYS_KEY = 'repertoire.plays.v1'
const readPlays = (): Play[] => JSON.parse(localStorage.getItem(LOCAL_PLAYS_KEY) ?? '[]')
const writePlays = (plays: Play[]) => localStorage.setItem(LOCAL_PLAYS_KEY, JSON.stringify(plays))
const LOCAL_SETS_KEY = 'repertoire.sets.v1'
const readSets = (): SongSet[] => JSON.parse(localStorage.getItem(LOCAL_SETS_KEY) ?? '[]')
const writeSets = (sets: SongSet[]) => localStorage.setItem(LOCAL_SETS_KEY, JSON.stringify(sets))
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
    writePlays(readPlays().filter((p) => p.song_id !== id))
  },
  async listPlays() {
    return readPlays()
  },
  async addPlay(songId, feltRusty) {
    const play: Play = { id: crypto.randomUUID(), song_id: songId, played_at: new Date().toISOString(), felt_rusty: feltRusty }
    writePlays([...readPlays(), play])
    return play
  },
  async removePlay(id) {
    writePlays(readPlays().filter((p) => p.id !== id))
  },
  async listSets() {
    return readSets()
  },
  async createSet(name, songIds) {
    const set: SongSet = { id: crypto.randomUUID(), name, song_ids: songIds, created_at: new Date().toISOString() }
    writeSets([...readSets(), set])
    return set
  },
  async updateSet(id, patch) {
    writeSets(readSets().map((s) => (s.id === id ? { ...s, ...patch } : s)))
  },
  async removeSet(id) {
    writeSets(readSets().filter((s) => s.id !== id))
  },
}
