// ─── Cache version — bump this on every deploy to bust stale cache ──────────
const CACHE_NAME = 'kamalscan-v3'

// Core shell assets to pre-cache (offline support)
const SHELL_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.svg',
  '/icon-192.png',
  '/icon-512.png',
]

// ─── Install: pre-cache shell assets ────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_ASSETS))
  )
  // Immediately take control — don't wait for old SW to die
  self.skipWaiting()
})

// ─── Activate: delete ALL old caches ────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  )
  // Take control of all open tabs immediately
  self.clients.claim()
})

// ─── Fetch: Network-First strategy ──────────────────────────────────────────
// Always try to get fresh content from the network.
// Only fall back to cache if the network fails (user is offline).
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return

  // For navigation requests (HTML pages), always go to network first
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // Update cache with fresh response
          const copy = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy))
          return response
        })
        .catch(() => caches.match('/index.html'))
    )
    return
  }

  // For JS/CSS/image assets — Network-First, cache as fallback
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.status === 200 && response.type === 'basic') {
          const copy = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy))
        }
        return response
      })
      .catch(() => caches.match(event.request))
  )
})
