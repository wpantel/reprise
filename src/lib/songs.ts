export const TONICS = [
  'C', 'C#', 'Db', 'D', 'D#', 'Eb', 'E', 'F', 'F#', 'Gb', 'G', 'G#', 'Ab', 'A', 'A#', 'Bb', 'B',
] as const
export type Tonic = (typeof TONICS)[number]
export type Mode = 'major' | 'minor'

/** Tonics offered in the picker, by mode (conventional spellings). */
export const MAJOR_TONICS: Tonic[] = ['C', 'C#', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B']
export const MINOR_TONICS: Tonic[] = ['C', 'C#', 'D', 'D#', 'Eb', 'E', 'F', 'F#', 'G', 'G#', 'Ab', 'A', 'A#', 'Bb', 'B']

export type Recall = 'memorized' | 'with_score' | 'by_ear'
export const RECALLS: { value: Recall; label: string }[] = [
  { value: 'memorized', label: 'Memorized' },
  { value: 'with_score', label: 'With score' },
  { value: 'by_ear', label: 'By ear' },
]
export const recallLabel = (r: Recall) => RECALLS.find((x) => x.value === r)!.label

export type ArrangementType = 'musescore' | 'pdf' | 'other'
export const ARRANGEMENT_TYPES: { value: ArrangementType; label: string }[] = [
  { value: 'musescore', label: 'MuseScore' },
  { value: 'pdf', label: 'PDF' },
  { value: 'other', label: 'Other link' },
]

export interface Song {
  id: string
  title: string
  artist: string | null
  key_tonic: Tonic | null
  key_mode: Mode | null
  recall: Recall | null
  confidence: number | null
  arrangement_url: string | null
  arrangement_type: ArrangementType | null
  tags: string[]
  /** Bookmarked as a song to learn: heard it, haven't started it. */
  want_to_learn: boolean
  created_at: string
}
export type SongPatch = Partial<Omit<Song, 'id' | 'created_at'>>
export interface NewSong {
  title: string
  artist?: string | null
  key_tonic?: Tonic | null
  key_mode?: Mode | null
  confidence?: number | null
  want_to_learn?: boolean
}

/** A song as saved before want_to_learn existed reads as not bookmarked. */
export function normalizeSong(raw: Omit<Song, 'want_to_learn'> & { want_to_learn?: boolean }): Song {
  return { ...raw, want_to_learn: raw.want_to_learn ?? false }
}

/** One time a song was played. */
export interface Play {
  id: string
  song_id: string
  played_at: string
  felt_rusty: boolean
}

/** A named, ordered list of songs. Ids of deleted songs may linger and are skipped when shown. */
export interface SongSet {
  id: string
  name: string
  song_ids: string[]
  created_at: string
}
export type SetPatch = Partial<Pick<SongSet, 'name' | 'song_ids'>>

/** "A:major". The single string form of a key used by pickers and filters. */
export const keyId = (tonic: Tonic, mode: Mode) => `${tonic}:${mode}`
export function parseKeyId(id: string): { key_tonic: Tonic | null; key_mode: Mode | null } {
  const [tonic, mode] = id.split(':')
  if ((TONICS as readonly string[]).includes(tonic) && (mode === 'major' || mode === 'minor')) {
    return { key_tonic: tonic as Tonic, key_mode: mode }
  }
  return { key_tonic: null, key_mode: null }
}
export const songKeyId = (s: Pick<Song, 'key_tonic' | 'key_mode'>) =>
  s.key_tonic && s.key_mode ? keyId(s.key_tonic, s.key_mode) : null

export const tonicLabel = (t: string) => t.replace('#', '♯').replace('b', '♭')
export function keyLabel(id: string) {
  const [tonic, mode] = id.split(':')
  return `${tonicLabel(tonic)} ${mode}`
}
/** Sort position: by tonic in pitch order, major before minor; no key last. */
export function keyOrder(id: string | null) {
  if (!id) return Number.MAX_SAFE_INTEGER
  const [tonic, mode] = id.split(':')
  return TONICS.indexOf(tonic as Tonic) * 2 + (mode === 'minor' ? 1 : 0)
}

const PITCH_CLASS: Record<Tonic, number> = {
  C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11,
}
/** 0 for C through 11 for B. Enharmonic spellings share a pitch class. */
export const pitchClass = (t: Tonic) => PITCH_CLASS[t]
export const PITCH_NAMES = ['C', 'C♯/D♭', 'D', 'D♯/E♭', 'E', 'F', 'F♯/G♭', 'G', 'G♯/A♭', 'A', 'A♯/B♭', 'B']

const PREFERRED: Record<Mode, Tonic[]> = {
  major: ['Db', 'Eb', 'F#', 'Ab', 'Bb'],
  minor: ['C#', 'Eb', 'F#', 'G#', 'Bb'],
}
/** Ways to spell a piano key as a tonic in this mode, most common first. */
export function spellings(pc: number, mode: Mode): Tonic[] {
  const all = (mode === 'major' ? MAJOR_TONICS : MINOR_TONICS).filter((t) => pitchClass(t) === pc)
  return all.sort((a, b) => Number(PREFERRED[mode].includes(b)) - Number(PREFERRED[mode].includes(a)))
}

/** Each key gets a hue by its place on the circle of fifths, so neighbouring keys look related. */
export const keyHue = (pc: number) => (25 + ((pc * 7) % 12) * 30) % 360

/** Confidence 1 to 5, written as dynamics. */
export const DYNAMICS = ['pp', 'p', 'mf', 'f', 'ff']
