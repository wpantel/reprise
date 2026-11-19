/** Lowercase, strip accents, straighten quotes. For search matching. */
export function fold(s: string) {
  return s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[‘’`]/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

/** Looser form for spotting duplicates: ignores punctuation, "&" vs "and", leading "the". */
export function dupKey(s: string) {
  return fold(s)
    .replace(/&/g, ' and ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/^the /, '')
}

/**
 * Splits a trailing "artist: Name" off a typed title, so
 * "Liebestraum No. 3 artist: Franz Liszt" → { title: "Liebestraum No. 3", artist: "Franz Liszt" }.
 * Case-insensitive, and the space before "artist:" is optional ("No. 3artist: Liszt" works).
 * Anything without both parts is left as a plain title.
 */
export function splitArtistTag(input: string): { title: string; artist: string | null } {
  const m = input.match(/^(.*?)\s*artist\s*:\s*(.*)$/i)
  const title = m?.[1].trim()
  const artist = m?.[2].trim()
  if (!title || !artist) return { title: input.trim(), artist: null }
  return { title, artist }
}
