import { DYNAMICS, MAJOR_TONICS, MINOR_TONICS, spellings, type Mode, type NewSong, type Tonic } from './songs'

const LETTER_PC: Record<string, number> = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 }

/**
 * Reads a key like "A major", "A flat major", "Bb minor", "F♯ min", "c#m" or just "D" (major).
 * Spellings the picker doesn't offer for that mode (e.g. "A# major") become the usual enharmonic ("Bb major").
 */
export function parseKey(text: string): { key_tonic: Tonic; key_mode: Mode } | null {
  const m = text
    .trim()
    .replace(/\.+$/, '')
    .toLowerCase()
    .match(/^([a-g])\s*(#|♯|b|♭|-?\s*sharp|-?\s*flat)?\s*(major|maj|minor|min|m)?$/)
  if (!m) return null
  const [, letter, acc = '', modeWord = 'major'] = m
  const shift = /#|♯|sharp/.test(acc) ? 1 : /b|♭|flat/.test(acc) ? -1 : 0
  const mode: Mode = modeWord.startsWith('maj') ? 'major' : 'minor'
  const typed = `${letter.toUpperCase()}${shift === 1 ? '#' : shift === -1 ? 'b' : ''}`
  const offered = mode === 'major' ? MAJOR_TONICS : MINOR_TONICS
  if ((offered as string[]).includes(typed)) return { key_tonic: typed as Tonic, key_mode: mode }
  const pc = (LETTER_PC[letter] + shift + 12) % 12
  return { key_tonic: spellings(pc, mode)[0], key_mode: mode }
}

/** "pp" to "ff" (any case) as confidence 1 to 5. */
export function parseConfidence(text: string): number | null {
  const i = DYNAMICS.indexOf(text.trim().replace(/\.+$/, '').toLowerCase())
  return i < 0 ? null : i + 1
}

/** "bookmark:" with no value or "yes" (any case) is true, "no" is false, anything else null. */
function parseYesNo(text: string): boolean | null {
  const v = text.trim().replace(/\.+$/, '').toLowerCase()
  return v === '' || v === 'yes' ? true : v === 'no' ? false : null
}

export type ParsedSong = Required<Pick<NewSong, 'title'>> &
  Pick<NewSong, 'artist' | 'key_tonic' | 'key_mode' | 'confidence' | 'want_to_learn'>

/**
 * Pulls "artist:", "key:", "confidence:" and "bookmark:" tags off a typed title, in any order, e.g.
 * "Liebestraum No. 3 key: A flat major artist: Franz Liszt confidence: mf".
 * "bookmark:" alone or "bookmark: yes" marks the song want to learn; "bookmark: no" doesn't.
 * A "bookmark:" at the very start marks it too, and the text after it stays the title.
 * Tag names are case-insensitive and need no space before them. A tag whose value
 * isn't understood (an empty artist, "key: H major", "confidence: loud") stays in the text.
 */
export function parseTags(input: string): ParsedSong {
  const text = input.trim()
  const found = [...text.matchAll(/(artist|key|confidence|bookmark)\s*:/gi)]
  // Each tag's value runs to the next tag, or the end.
  const tags = found.map((m, i) => ({
    name: m[1].toLowerCase(),
    start: m.index!,
    valueStart: m.index! + m[0].length,
    end: found[i + 1]?.index ?? text.length,
  }))

  const song: Omit<ParsedSong, 'title'> = {}
  const kept: typeof tags = []
  for (const tag of tags) {
    const value = text.slice(tag.valueStart, tag.end).trim().replace(/[\s,;|]+$/, '')
    if (tag.name === 'artist' && value) song.artist = value
    else if (tag.name === 'key' && parseKey(value)) Object.assign(song, parseKey(value))
    else if (tag.name === 'confidence' && parseConfidence(value)) song.confidence = parseConfidence(value)
    else if (tag.name === 'bookmark' && parseYesNo(value) !== null) song.want_to_learn = parseYesNo(value)!
    else if (tag.name === 'bookmark' && tag.start === 0) {
      // A leading "bookmark:" flags the song; what follows it is the title.
      song.want_to_learn = true
      kept.push({ ...tag, end: tag.valueStart })
      continue
    } else continue
    kept.push(tag)
  }

  // Everything that isn't a recognised tag is the title. A rejected tag's text stays where it was.
  let title = ''
  let from = 0
  for (const tag of kept) {
    title += text.slice(from, tag.start) + ' '
    from = tag.end
  }
  title = (title + text.slice(from)).replace(/\s+/g, ' ').trim().replace(/[\s,;|]+$/, '')
  if (!title) return { title: text, artist: null }
  return { title, artist: null, ...song }
}
