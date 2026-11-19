import type { NewSong, Song } from './songs'
import { parseTags } from './tags'
import { dupKey } from './text'

/** One song per line. Blank lines and list markers ("- ", "3. ") are dropped. */
export function parseBulk(text: string, splitArtist: boolean): NewSong[] {
  return text
    .split('\n')
    .map((line) => line.trim().replace(/^([-*•]|\d+[.)])\s+/, ''))
    .filter(Boolean)
    .map((line) => {
      const tagged = parseTags(line)
      if (splitArtist && !tagged.artist) {
        const m = tagged.title.match(/^(.+?)\s+[-–—]\s+(.+)$/)
        if (m) return { ...tagged, title: m[1].trim(), artist: m[2].trim() }
      }
      return tagged
    })
}

export type DuplicateStatus = 'new' | 'in_library' | 'repeated'

function sameSong(a: NewSong, b: { title: string; artist?: string | null }) {
  if (dupKey(a.title) !== dupKey(b.title)) return false
  // Artists only tell songs apart when both are known.
  return !a.artist || !b.artist || dupKey(a.artist) === dupKey(b.artist)
}

/** Flags entries already in the library, or repeated earlier in the same list. */
export function flagDuplicates(entries: NewSong[], existing: Pick<Song, 'title' | 'artist'>[]): DuplicateStatus[] {
  return entries.map((entry, i) => {
    if (existing.some((s) => sameSong(entry, s))) return 'in_library'
    if (entries.slice(0, i).some((e) => sameSong(entry, e))) return 'repeated'
    return 'new'
  })
}
