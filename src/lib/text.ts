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
