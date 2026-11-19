// Reprise service worker: keeps a copy of the app on the device so the
// installed app opens with a weak signal or none at all. Song data is not
// handled here; the app keeps its own copy (src/lib/offline.ts). Requests to
// Supabase pass straight through.

const CACHE = 'reprise-shell-v1'
const STATIC = ['/manifest.webmanifest', '/favicon.svg', '/icon-192.png', '/icon-512.png', '/apple-touch-icon.png']
const FONT_HOSTS = new Set(['fonts.googleapis.com', 'fonts.gstatic.com'])
/** How long to wait for the network before opening the saved copy of the page. */
const NAV_TIMEOUT_MS = 3000

/** Built files (hashed names under /assets/) that a copy of index.html loads. */
const assetsIn = (html) => [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map((m) => m[1])

/** Saves a fresh page and drops built files it no longer loads, so old versions don't pile up. */
async function savePage(response) {
  const html = await response.clone().text()
  const cache = await caches.open(CACHE)
  await cache.put('/', response)
  const keep = new Set(assetsIn(html))
  for (const req of await cache.keys()) {
    const path = new URL(req.url).pathname
    if (path.startsWith('/assets/') && !keep.has(path)) await cache.delete(req)
  }
  return html
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const page = await fetch('/', { cache: 'no-cache' })
      if (!page.ok) throw new Error(`Couldn't fetch the app page (${page.status})`)
      const html = await savePage(page)
      const cache = await caches.open(CACHE)
      await cache.addAll([...STATIC, ...assetsIn(html)])
      await self.skipWaiting()
    })(),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      for (const name of await caches.keys()) if (name !== CACHE) await caches.delete(name)
      await self.clients.claim()
    })(),
  )
})

const isPage = (response) => response.ok && (response.headers.get('content-type') ?? '').includes('text/html')

/** The page: from the network when it answers quickly, otherwise the saved copy. */
async function openPage(event) {
  const network = fetch(event.request)
  // Keep the saved copy current whenever the network does answer, even late.
  event.waitUntil(network.then((res) => (isPage(res) ? savePage(res.clone()) : undefined)).catch(() => {}))
  const saved = await caches.match('/')
  if (!saved) return network
  const timeout = new Promise((resolve) => setTimeout(() => resolve(saved), NAV_TIMEOUT_MS))
  const fresh = network.then((res) => (isPage(res) ? res : saved), () => saved)
  return Promise.race([fresh, timeout])
}

/** Hashed build files never change, so a saved copy is always right. */
async function cacheFirst(request) {
  const saved = await caches.match(request)
  if (saved) return saved
  const res = await fetch(request)
  if (res.ok) (await caches.open(CACHE)).put(request, res.clone())
  return res
}

/** Answer from the saved copy and refresh it in the background. */
async function staleWhileRevalidate(event) {
  const saved = await caches.match(event.request)
  const network = fetch(event.request).then(async (res) => {
    if (res.ok || res.type === 'opaque') await (await caches.open(CACHE)).put(event.request, res.clone())
    return res
  })
  if (saved) {
    event.waitUntil(network.catch(() => {}))
    return saved
  }
  return network
}

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return
  const url = new URL(request.url)

  if (url.origin === self.location.origin) {
    if (request.mode === 'navigate') return event.respondWith(openPage(event))
    if (url.pathname.startsWith('/assets/')) return event.respondWith(cacheFirst(request))
    if (STATIC.includes(url.pathname)) return event.respondWith(staleWhileRevalidate(event))
    return
  }
  if (FONT_HOSTS.has(url.hostname)) event.respondWith(staleWhileRevalidate(event))
})
