/*
 * Copie hors ligne du site (service worker), publiée en sw.js par database/vite-plugin.mjs.
 *  - page et base : version en ligne d'abord, copie enregistrée si le réseau ou l'hébergeur ne répond pas
 *  - scripts et styles (nom unique à chaque version) : copie enregistrée d'abord
 *  - images : copie enregistrée, rafraîchie en arrière-plan
 * L'administration, le service des demandes et le fond de carte ne passent pas par ici.
 */
const VERSION = '__VERSION__'
const FILES = ['__FILES__']
const PREFIX = 'kanaky-'
const SITE = `${PREFIX}site-${VERSION}`
const IMAGES = `${PREFIX}images`
const MAX_IMAGES = 200
const PAGE = new URL('./', self.registration.scope).href
const DATABASE = new URL('data/kanaky.sqlite', PAGE).href

self.addEventListener('install', (event) => {
  // Tout ou rien : la page enregistrée correspond toujours à ses scripts.
  const requests = [PAGE, DATABASE, ...FILES.map((f) => new URL(f, PAGE).href)].map((url) => new Request(url, { cache: 'no-cache' }))
  event.waitUntil(
    caches
      .open(SITE)
      .then((cache) => cache.addAll(requests))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  const clear = async () => {
    const old = (await caches.keys()).filter((k) => k.startsWith(PREFIX) && k !== SITE && k !== IMAGES)
    await Promise.all(old.map((k) => caches.delete(k)))
    await self.clients.claim()
  }
  event.waitUntil(clear())
})

async function save(name, key, response) {
  try {
    const cache = await caches.open(name)
    await cache.put(key, response)
    if (name !== IMAGES) return
    const keys = await cache.keys()
    await Promise.all(keys.slice(0, Math.max(0, keys.length - MAX_IMAGES)).map((k) => cache.delete(k)))
  } catch {
    // Stockage plein ou téléchargement interrompu : le site fonctionne sans copie.
  }
}

// Copie enregistrée, marquée pour que la page puisse le signaler.
async function savedCopy(key) {
  const saved = await (await caches.open(SITE)).match(key)
  if (!saved) return null
  const headers = new Headers(saved.headers)
  headers.set('X-Hors-Ligne', '1')
  return new Response(saved.body, { status: saved.status, headers })
}

// timeout : délai avant le début de la réponse
async function networkFirst(event, key, timeout, keep) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeout)
  try {
    const response = await fetch(key, { cache: 'no-cache', signal: controller.signal })
    clearTimeout(timer)
    if (!response.ok) return (await savedCopy(key)) || response
    if (keep) event.waitUntil(save(SITE, key, response.clone()))
    return response
  } catch (e) {
    clearTimeout(timer)
    const saved = await savedCopy(key)
    if (saved) return saved
    throw e
  }
}

async function cacheFirst(event) {
  const saved = await (await caches.open(SITE)).match(event.request)
  if (saved) return saved
  const response = await fetch(event.request)
  if (response.ok) event.waitUntil(save(SITE, event.request, response.clone()))
  return response
}

async function imageResponse(event) {
  const saved = (await (await caches.open(IMAGES)).match(event.request)) || (await (await caches.open(SITE)).match(event.request))
  const fresh = fetch(event.request).then((response) => {
    if (response.ok) event.waitUntil(save(IMAGES, event.request, response.clone()))
    return response
  })
  if (!saved) return fresh
  event.waitUntil(fresh.catch(() => {}))
  return saved
}

self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = request.url.split(/[?#]/)[0]
  if (request.method !== 'GET' || !url.startsWith(PAGE)) return
  const path = url.slice(PAGE.length)
  if (request.mode === 'navigate') {
    // La page est enregistrée seulement à l'installation, avec ses scripts.
    if (path === '' || path === 'index.html') event.respondWith(networkFirst(event, PAGE, 6000, false))
  } else if (url === DATABASE) event.respondWith(networkFirst(event, DATABASE, 10000, true))
  else if (path.startsWith('assets/')) event.respondWith(cacheFirst(event))
  else if (path.startsWith('images/')) event.respondWith(imageResponse(event))
})
