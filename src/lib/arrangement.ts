import type { ArrangementType } from './songs'

/** Adds https:// when missing; returns null unless the result is an http(s) URL. */
export function normalizeUrl(input: string): string | null {
  const raw = input.trim()
  if (!raw) return null
  const candidate = /^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : `https://${raw}`
  try {
    const url = new URL(candidate)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
    if (!url.hostname.includes('.') && url.hostname !== 'localhost') return null
    return url.href
  } catch {
    return null
  }
}

/** The type a URL makes obvious, or null when it doesn't. */
export function detectArrangementType(url: string): ArrangementType | null {
  try {
    const u = new URL(url)
    const host = u.hostname.toLowerCase()
    if (host === 'musescore.com' || host.endsWith('.musescore.com')) return 'musescore'
    if (u.pathname.toLowerCase().endsWith('.pdf')) return 'pdf'
  } catch {
    /* not a URL */
  }
  return null
}
