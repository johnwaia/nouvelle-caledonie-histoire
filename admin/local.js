// Version locale : les actions sont exécutées par admin/server.mjs.
import * as L from '/leaflet.js'
import { attempt } from './dom.js'
import { startAdmin } from './ui.js'

const versions = new Map() // une image remplacée doit être rechargée

async function request(method, path, body) {
  const raw = body instanceof Blob
  const res = await fetch('/api/' + path, {
    method,
    headers: body && !raw ? { 'Content-Type': 'application/json' } : {},
    body: raw ? body : body && JSON.stringify(body),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error)
  return data
}

attempt(() =>
  startAdmin({
    L,
    imageUrl: (id) => '/' + id.split('/').map(encodeURIComponent).join('/') + (versions.has(id) ? '?v=' + versions.get(id) : ''),
    async call(method, path, body) {
      const data = await request(method, path, body)
      if (body instanceof Blob) versions.set(decodeURIComponent(path.split('?')[0].split('/')[1]), Date.now())
      return data
    },
    demandes: {
      list: () => request('GET', 'demandes'),
      setStatus: (id, status) => request('PATCH', 'demandes/' + id, { status }),
      remove: (id) => request('DELETE', 'demandes/' + id),
    },
  }),
)
