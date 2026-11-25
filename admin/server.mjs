/*
 * Administration : npm run admin → http://127.0.0.1:5180
 * Fonctionne uniquement sur cet ordinateur et modifie directement database/kanaky.sqlite.
 * Pour publier : committer database/kanaky.sqlite puis pousser sur main.
 */
import { createServer } from 'node:http'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { openDb } from '../database/db.mjs'
import { handle, ApiError, MAX_UPLOAD } from '../src/db/api.js'

const PORT = Number(process.env.PORT) || 5180
const HOSTS = new Set([`127.0.0.1:${PORT}`, `localhost:${PORT}`])
const db = openDb()

// Adresse du service des demandes
try {
  process.loadEnvFile(new URL('../.env.production', import.meta.url))
} catch {
  // fichier absent : les demandes seront signalées comme indisponibles
}
const DEMANDES_URL = process.env.VITE_DEMANDES_URL

const STATIC = {
  '/': ['index.html', 'text/html'],
  '/admin.css': ['admin.css', 'text/css'],
  '/leaflet.js': ['../node_modules/leaflet/dist/leaflet-src.esm.js', 'text/javascript'],
  '/leaflet.css': ['../node_modules/leaflet/dist/leaflet.css', 'text/css'],
  '/src/db/proposals.js': ['../src/db/proposals.js', 'text/javascript'],
  '/src/db/checks.js': ['../src/db/checks.js', 'text/javascript'],
  '/src/utils/text.js': ['../src/utils/text.js', 'text/javascript'],
}
for (const name of ['local', 'ui', 'dom', 'place', 'demandes']) STATIC[`/admin/${name}.js`] = [`${name}.js`, 'text/javascript']

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let size = 0
    req.on('data', (c) => {
      size += c.length
      if (size <= MAX_UPLOAD) chunks.push(c)
    })
    req.on('end', () => {
      if (size > MAX_UPLOAD) reject(new ApiError(413, 'Fichier trop lourd (8 Mo au maximum)'))
      else resolve(Buffer.concat(chunks))
    })
    req.on('error', reject)
  })
}
const readJson = async (req) => {
  try {
    return JSON.parse(await readBody(req))
  } catch (e) {
    throw e.status ? e : new ApiError(400, 'Requête illisible')
  }
}

// Corps attendu : les octets d'une image envoyée, sinon une fiche en JSON.
async function readPayload(req, path) {
  if (req.method === 'POST' && path.startsWith('images/')) return readBody(req)
  if (req.method === 'POST' || req.method === 'PUT') return readJson(req)
  return undefined
}

// Demandes de modification : relayées au service, avec l'identité GitHub de cet ordinateur (commande « gh »).
function githubToken() {
  if (process.env.GITHUB_TOKEN) return process.env.GITHUB_TOKEN
  try {
    return execFileSync('gh', ['auth', 'token'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
  } catch {
    throw new ApiError(401, 'connectez-vous à GitHub avec « gh auth login ».')
  }
}
async function relayDemandes(req, path) {
  if (!DEMANDES_URL) throw new ApiError(503, "le service n'est pas configuré (VITE_DEMANDES_URL dans .env.production).")
  const body = req.method === 'PATCH' ? await readBody(req) : undefined
  const res = await fetch(`${DEMANDES_URL}/${path}`, {
    method: req.method,
    headers: { Authorization: `Bearer ${githubToken()}`, 'Content-Type': 'application/json' },
    body,
  })
  const data = await res.json()
  if (!res.ok) throw new ApiError(res.status, data.error)
  return data
}

async function api(req, url) {
  const path = url.pathname.slice('/api/'.length) + url.search
  if (/^demandes(\/[\w-]+)?$/.test(path)) return relayDemandes(req, path)
  return handle(db, req.method, path, await readPayload(req, path))
}

function sendImage(res, id) {
  const row = db.prepare('SELECT mime, data FROM image_data WHERE image_id = ?').get(id)
  if (!row) throw new ApiError(404, 'Image introuvable')
  // Un SVG ouvert directement ne doit pas pouvoir exécuter de script.
  res.writeHead(200, { 'Content-Type': row.mime, 'Cache-Control': 'no-cache', 'Content-Security-Policy': "script-src 'none'" })
  res.end(Buffer.from(row.data))
}

createServer(async (req, res) => {
  const json = (status, body) => {
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' })
    res.end(JSON.stringify(body))
  }
  try {
    // Seule la page d'administration elle-même peut appeler l'API (pas un autre site ouvert dans le navigateur).
    if (!HOSTS.has(req.headers.host)) throw new ApiError(403, 'Accès refusé')
    const url = new URL(req.url, `http://${req.headers.host}`)
    if (req.method !== 'GET' && req.headers.origin !== url.origin) throw new ApiError(403, 'Accès refusé')
    if (url.pathname.startsWith('/api/')) return json(200, await api(req, url))
    if (url.pathname.startsWith('/images/')) return sendImage(res, decodeURIComponent(url.pathname.slice(1)))
    const file = Object.hasOwn(STATIC, url.pathname) && STATIC[url.pathname]
    if (!file) throw new ApiError(404, 'Page introuvable')
    res.writeHead(200, { 'Content-Type': `${file[1]}; charset=utf-8`, 'Cache-Control': 'no-cache', 'X-Frame-Options': 'DENY' })
    res.end(readFileSync(new URL(file[0], import.meta.url)))
  } catch (e) {
    json(e.status || 400, { error: e.message })
  }
}).listen(PORT, '127.0.0.1', () => console.log(`Administration : http://127.0.0.1:${PORT}  (Ctrl+C pour arrêter)`))
