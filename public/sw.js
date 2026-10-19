// Offline shell for the installed app. Pages (navigations) are fetched from the network first, so a new deploy
// is picked up on the next load; the cached shell is used only when offline. Hashed build assets are cached
// on first use. API, media and websocket requests are never touched.
const CACHE = 'gunasheela-shell-v4'
const SHELL = ['/', '/index.html', '/manifest.webmanifest', '/favicon-64.png', '/icon-192.png']

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()))
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (e) => {
  const req = e.request
  const url = new URL(req.url)
  if (req.method !== 'GET' || url.origin !== self.location.origin) return
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/media/') || url.pathname.startsWith('/ws/')) return

  if (req.mode === 'navigate') {
    // Network first: always the latest index.html; the cached one only when offline.
    e.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone()
            caches.open(CACHE).then((c) => c.put('/index.html', copy))
          }
          return res
        })
        .catch(() => caches.match('/index.html')),
    )
    return
  }

  // Static files: cache first (build assets carry content hashes, so a new deploy uses new file names).
  e.respondWith(
    caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      if (res.ok && res.type === 'basic') {
        const copy = res.clone()
        caches.open(CACHE).then((c) => c.put(req, copy))
      }
      return res
    })),
  )
})
