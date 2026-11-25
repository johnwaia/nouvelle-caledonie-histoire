/*
 * Version en ligne : la base du dépôt est ouverte dans le navigateur, puis republiée par un commit GitHub.
 * Le commit déclenche la publication du site (.github/workflows/deploy.yml).
 * Le jeton reste en mémoire : il n'est écrit nulle part. Il est envoyé à GitHub, et au service des demandes qui le fait
 * vérifier par GitHub.
 */
import { openBrowserDb } from '../src/db/browser.js'
import { handle } from '../src/db/api.js'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { $, attempt, attemptWithProgress, progress } from './dom.js'
import { isDirty, startAdmin } from './ui.js'

// Dépôt et branche d'où le site a été publié (voir vite.config.js)
const REPO = __REPO__
const BRANCH = __BRANCH__
const DB_PATH = 'database/kanaky.sqlite'

const DEMANDES_URL = import.meta.env.VITE_DEMANDES_URL

let token = ''
for (const node of document.querySelectorAll('.repo-name')) node.textContent = REPO.split('/')[1]
document.querySelector('.target').textContent = `${REPO} · ${BRANCH}`

/* ---------- GitHub ---------- */
const MESSAGES = {
  401: 'Jeton refusé ou expiré.',
  403: "Le jeton n'a pas le droit de modifier le dépôt (« Contents : Read and write »).",
  404: 'Dépôt ou base introuvable : vérifiez que le jeton donne accès à ce dépôt.',
  409: 'Le dépôt a changé entre-temps : réessayez.',
  422: 'Le dépôt a changé entre-temps : réessayez.',
}
const githubHeaders = (accept) => ({ Authorization: `Bearer ${token}`, Accept: accept, 'X-GitHub-Api-Version': '2022-11-28' })
const githubUrl = (path) => `https://api.github.com/repos/${REPO}${path}`
const githubError = (status) => new Error(MESSAGES[status] || `GitHub a répondu ${status}`)

async function github(method, path, body, accept = 'application/vnd.github+json') {
  const res = await fetch(githubUrl(path), { method, cache: 'no-store', headers: githubHeaders(accept), body: body && JSON.stringify(body) })
  if (!res.ok) throw githubError(res.status)
  return accept.endsWith('raw') ? res.arrayBuffer() : res.json()
}
// Envoi d'un fichier, avec son avancement (de 0 à 1)
function githubUpload(path, body, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', githubUrl(path))
    for (const [k, v] of Object.entries(githubHeaders('application/vnd.github+json'))) xhr.setRequestHeader(k, v)
    xhr.responseType = 'json'
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total)
    xhr.onload = () => (xhr.status < 300 ? resolve(xhr.response) : reject(githubError(xhr.status)))
    xhr.onerror = () => reject(new Error('Connexion à GitHub interrompue : réessayez.'))
    xhr.send(JSON.stringify(body))
  })
}

// Service des demandes de modification (worker/)
async function demandes(method, path = '', body) {
  if (!DEMANDES_URL) throw new Error("le service n'est pas configuré (VITE_DEMANDES_URL).")
  const res = await fetch(`${DEMANDES_URL}/demandes${path}`, {
    method,
    cache: 'no-store',
    headers: { Authorization: `Bearer ${token}`, ...(body && { 'Content-Type': 'application/json' }) },
    body: body && JSON.stringify(body),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error)
  return data
}

// Dernier commit de la branche, et empreinte de la base qu'il contient
async function readHead() {
  const { commit } = await github('GET', `/branches/${BRANCH}`)
  const folder = await github('GET', `/contents/${DB_PATH.split('/')[0]}?ref=${commit.sha}`)
  const file = folder.find((f) => f.path === DB_PATH)
  if (!file) throw new Error(`La base n'est pas encore sur la branche ${BRANCH}.`)
  return { commit: commit.sha, tree: commit.commit.tree.sha, blob: file.sha }
}

function toBase64(bytes) {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result.slice(r.result.indexOf(',') + 1))
    r.onerror = () => reject(r.error)
    r.readAsDataURL(new Blob([bytes]))
  })
}

/* ---------- Base ouverte dans la page ---------- */
let db
let loadedBlob // empreinte de la base chargée : évite d'écraser le travail de quelqu'un d'autre
let changes = 0
let publishing = false
const imageUrls = new Map()

function imageUrl(id) {
  if (!imageUrls.has(id)) {
    const row = db.prepare('SELECT mime, data FROM image_data WHERE image_id = ?').get(id)
    imageUrls.set(id, row ? URL.createObjectURL(new Blob([row.data], { type: row.mime })) : '')
  }
  return imageUrls.get(id)
}
function forgetImage(id) {
  if (imageUrls.get(id)) URL.revokeObjectURL(imageUrls.get(id))
  imageUrls.delete(id)
}

async function call(method, path, body) {
  if (publishing && method !== 'GET') throw new Error('Publication en cours : patientez.')
  const upload = body instanceof Blob
  const result = handle(db, method, path, upload ? new Uint8Array(await body.arrayBuffer()) : body)
  if (path.startsWith('images/')) forgetImage(decodeURIComponent(path.split('?')[0].slice('images/'.length)))
  return result
}

const countLabel = (n) => (n > 1 ? `${n} modifications` : `${n} modification`)

function showPending() {
  $('pending').textContent = changes ? `${countLabel(changes)} à publier` : 'Tout est publié'
  $('publish').disabled = !changes || publishing
  $('publish').textContent = publishing ? 'Publication…' : 'Publier'
}

async function commitDatabase() {
  progress.step('Vérification de la version en ligne…', 5)
  const head = await readHead()
  if (head.blob !== loadedBlob) {
    throw new Error("La base a été modifiée ailleurs depuis votre connexion. Notez vos changements, rechargez la page et refaites-les.")
  }
  const published = changes
  progress.step('Préparation de la base…', 10)
  const content = await toBase64(db.export())
  const blob = await githubUpload('/git/blobs', { content, encoding: 'base64' }, (part) =>
    progress.step(`Envoi de la base… ${Math.round(part * 100)} %`, 15 + part * 60),
  )
  progress.step('Enregistrement des changements…', 80)
  const tree = await github('POST', '/git/trees', {
    base_tree: head.tree,
    tree: [{ path: DB_PATH, mode: '100644', type: 'blob', sha: blob.sha }],
  })
  const commit = await github('POST', '/git/commits', {
    message: `data: mise à jour depuis l'administration (${countLabel(published)})`,
    tree: tree.sha,
    parents: [head.commit],
  })
  progress.step('Publication…', 92)
  await github('PATCH', `/git/refs/heads/${BRANCH}`, { sha: commit.sha, force: false })
  loadedBlob = blob.sha
  changes -= published
  return commit.sha
}

async function publish() {
  if (isDirty()) throw new Error("Enregistrez ou abandonnez d'abord la fiche ouverte.")
  if (!changes) return // déjà publié
  publishing = true
  showPending()
  try {
    watchDeployment(await commitDatabase())
  } finally {
    publishing = false
    showPending()
  }
}

// Prévient quand le site en ligne correspond à la dernière publication.
const CHECK_EVERY = 10_000
const MAX_CHECKS = 30
let watched = ''
function watchDeployment(commit) {
  watched = commit
  let checks = 0
  const check = async () => {
    if (watched !== commit) return // une publication plus récente a pris le relais
    const online = await fetch(`data/version.json?${Date.now()}`, { cache: 'no-store' }).then((r) => r.json()).catch(() => null)
    if (online?.commit === commit) progress.done('Le site en ligne est à jour')
    else if (++checks < MAX_CHECKS) setTimeout(check, CHECK_EVERY)
    else progress.info("Publié, mais le site n'est pas encore à jour : voir l'onglet Actions sur GitHub")
  }
  setTimeout(check, CHECK_EVERY)
}

$('publish').onclick = () =>
  attemptWithProgress('Publication…', async () => {
    await publish()
    return 'Publié — le site sera à jour dans une à deux minutes'
  })

/* ---------- Connexion ---------- */
$('login').onsubmit = (e) => {
  e.preventDefault()
  const button = $('login').querySelector('button')
  button.disabled = true
  button.textContent = 'Chargement…'
  attempt(async () => {
    try {
      token = $('token').value.trim()
      const repo = await github('GET', '')
      if (!repo.permissions?.push) throw new Error(MESSAGES[403])
      const head = await readHead()
      db = await openBrowserDb(github('GET', `/git/blobs/${head.blob}`, undefined, 'application/vnd.github.raw'))
      loadedBlob = head.blob
      $('token').value = ''
      await startAdmin({
        call,
        imageUrl,
        L,
        publish,
        demandes: {
          list: () => demandes('GET'),
          setStatus: (id, status) => demandes('PATCH', `/${id}`, { status }),
          remove: (id) => demandes('DELETE', `/${id}`),
        },
        pending: () => changes > 0,
        onChange() {
          changes++
          showPending()
        },
      })
      showPending()
      $('login').remove()
      document.querySelector('main').hidden = false
      document.querySelector('.publish').hidden = false
    } catch (err) {
      token = ''
      throw err
    } finally {
      button.disabled = false
      button.textContent = 'Se connecter'
    }
  })
}
