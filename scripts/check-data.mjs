// Vérifie public/data/events.json (et tribus.json) avant publication : `npm run check-data`
import { readFileSync } from 'node:fs'

const file = process.argv[2] || new URL('../public/data/events.json', import.meta.url)
const DATE_RE = /^-?\d{1,4}(-(0[1-9]|1[0-2])(-(0[1-9]|[12]\d|3[01]))?)?$/
const URL_RE = /^https?:\/\//
const errors = []
const warnings = []

let data
try {
  data = JSON.parse(readFileSync(file, 'utf8'))
} catch (e) {
  console.error(`✖ JSON invalide : ${e.message}`)
  process.exit(1)
}

const cats = data.categories || {}
const ids = new Set()
const toNum = (d) => {
  const [y, m = '1', j = '1'] = String(d).replace(/^-/, 'N').split('-')
  return (y.startsWith('N') ? -+y.slice(1) : +y) + (+m - 1) / 12 + (+j - 1) / 365
}
const outsideArchipelago = ([lat, lon]) => lat < -23.5 || lat > -18.5 || lon < 158 || lon > 169
const isLatLon = (c) => Array.isArray(c) && typeof c[0] === 'number' && typeof c[1] === 'number'

/* ---------- Vérifications d'un événement ---------- */
function checkId(ev, where) {
  if (!ev.id) errors.push(`${where} : "id" manquant`)
  else if (!/^[a-z0-9-]+$/.test(ev.id)) errors.push(`${where} : "id" doit contenir uniquement a-z, 0-9 et tirets`)
  else if (ids.has(ev.id)) errors.push(`${where} : "id" en double`)
  ids.add(ev.id)
}

function checkRequiredFields(ev, where) {
  for (const f of ['title', 'date', 'place', 'category', 'description']) {
    if (!ev[f] || typeof ev[f] !== 'string') errors.push(`${where} : champ "${f}" manquant`)
  }
}

function checkDates(ev, where) {
  if (ev.date && !DATE_RE.test(ev.date)) errors.push(`${where} : date "${ev.date}" invalide (AAAA, AAAA-MM ou AAAA-MM-JJ)`)
  if (ev.endDate && !DATE_RE.test(ev.endDate)) errors.push(`${where} : endDate "${ev.endDate}" invalide`)
  if (ev.date && ev.endDate && toNum(ev.endDate) < toNum(ev.date)) errors.push(`${where} : endDate antérieure à date`)
}

function checkCategory(ev, where) {
  if (ev.category && !cats[ev.category]) {
    errors.push(`${where} : catégorie "${ev.category}" inconnue (${Object.keys(cats).join(', ')})`)
  }
}

function checkCoords(ev, where) {
  if (ev.coords === null || ev.coords === undefined) return // événement hors de l'archipel
  if (!isLatLon(ev.coords)) errors.push(`${where} : coords doit être [latitude, longitude] ou null`)
  else if (outsideArchipelago(ev.coords)) warnings.push(`${where} : coords [${ev.coords}] hors de l'archipel (inversion lat/lon ?)`)
}

function checkLinks(ev, where) {
  if (!ev.sources?.length) warnings.push(`${where} : aucune source`)
  for (const s of ev.sources || []) {
    if (typeof s === 'object' && s.url && !URL_RE.test(s.url)) errors.push(`${where} : URL de source invalide "${s.url}"`)
  }
  for (const v of ev.videos || []) {
    const url = typeof v === 'string' ? v : v?.url
    if (!url || !URL_RE.test(url)) errors.push(`${where} : URL de vidéo invalide "${url}"`)
  }
}

function checkImage(ev, where) {
  if (!ev.image) return
  if (!ev.image.url) errors.push(`${where} : image sans "url"`)
  if (!ev.image.credit) warnings.push(`${where} : image sans crédit`)
}

;(data.events || []).forEach((ev, i) => {
  const where = `#${i + 1} (${ev.id || 'sans id'})`
  for (const check of [checkId, checkRequiredFields, checkDates, checkCategory, checkCoords, checkLinks, checkImage]) {
    check(ev, where)
  }
})

/* ---------- Tribus (facultatif) ---------- */
function checkTribus() {
  let text
  try {
    text = readFileSync(new URL('../public/data/tribus.json', import.meta.url), 'utf8')
  } catch (e) {
    if (e.code !== 'ENOENT') errors.push(`tribus.json illisible : ${e.message}`)
    return 0
  }
  let tribus
  try {
    tribus = JSON.parse(text).tribus || []
  } catch (e) {
    errors.push(`tribus.json invalide : ${e.message}`)
    return 0
  }
  const tids = new Set()
  tribus.forEach((t, i) => {
    const where = `tribu #${i + 1} (${t.id || 'sans id'})`
    if (!t.id || tids.has(t.id)) errors.push(`${where} : "id" manquant ou en double`)
    tids.add(t.id)
    for (const f of ['nom', 'commune', 'aire']) if (!t[f]) errors.push(`${where} : champ "${f}" manquant`)
    if (!isLatLon(t.coords)) errors.push(`${where} : coords doit être [latitude, longitude]`)
    else if (outsideArchipelago(t.coords)) warnings.push(`${where} : coords hors de l'archipel (inversion lat/lon ?)`)
  })
  return tribus.length
}
const tribuCount = checkTribus()

/* ---------- Bilan ---------- */
warnings.forEach((w) => console.warn(`⚠ ${w}`))
if (errors.length) {
  errors.forEach((e) => console.error(`✖ ${e}`))
  console.error(`\n${errors.length} erreur(s) — corrigez le fichier avant de publier.`)
  process.exit(1)
}
console.log(
  `✔ ${ids.size} événements valides, ${Object.keys(cats).length} catégories, ${(data.periods || []).length} périodes, ${tribuCount} tribus.`,
)
