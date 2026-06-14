const CACHE = 'gym-trainer-v9'
const URLS = ['/', 'index.html', 'css/style.css', 'js/data.js', 'js/auth.js', 'js/storage.js', 'js/db.js', 'js/app.js', 'manifest.json']

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(URLS)))
  self.skipWaiting()
})

self.addEventListener('activate', e => {
  e.waitUntil(clients.claim())
})

self.addEventListener('fetch', e => {
  if (e.request.url.includes('github') || e.request.url.includes('googleapis') || e.request.url.includes('youtube')) return
  e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request))
  )
})
