// Ouvre dans le navigateur la base publiée avec le site (textes et liens ; les images sont des fichiers à part).
import { openBrowserDb } from './browser'
import { readAll } from './read'
import { reader } from './write'

const RETRY_DELAYS = [1000, 3000] // nouveaux essais en cas de coupure brève

async function download(delays = RETRY_DELAYS) {
  try {
    const res = await fetch(import.meta.env.BASE_URL + 'data/kanaky.sqlite', { cache: 'no-cache' })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    // Réponse du service worker (src/sw.js) : copie enregistrée lors d'une visite précédente
    return { bytes: await res.arrayBuffer(), offline: res.headers.has('X-Hors-Ligne') }
  } catch (e) {
    if (!delays.length) throw e
    await new Promise((done) => setTimeout(done, delays[0]))
    return download(delays.slice(1))
  }
}

export async function loadDatabase() {
  const file = download()
  const db = await openBrowserDb(file.then((f) => f.bytes))
  try {
    return { ...readAll(reader(db)), offline: (await file).offline }
  } finally {
    db.close()
  }
}
