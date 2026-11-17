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
  created_at: string
}
export type SongPatch = Partial<Omit<Song, 'id' | 'created_at'>>
export interface NewSong {
  title: string
  artist?: string | null
}

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
