// Vérifie public/data/events.json avant publication : `npm run check-data`
import { readFileSync } from 'node:fs'

const file = process.argv[2] || new URL('../public/data/events.json', import.meta.url)
const DATE_RE = /^-?\d{1,4}(-(0[1-9]|1[0-2])(-(0[1-9]|[12]\d|3[01]))?)?$/
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

;(data.events || []).forEach((ev, i) => {
  const where = `#${i + 1} (${ev.id || 'sans id'})`
  if (!ev.id) errors.push(`${where} : "id" manquant`)
  else if (!/^[a-z0-9-]+$/.test(ev.id)) errors.push(`${where} : "id" doit contenir uniquement a-z, 0-9 et tirets`)
  else if (ids.has(ev.id)) errors.push(`${where} : "id" en double`)
  ids.add(ev.id)

  for (const f of ['title', 'date', 'place', 'category', 'description']) {
    if (!ev[f] || typeof ev[f] !== 'string') errors.push(`${where} : champ "${f}" manquant`)
  }
  if (ev.date && !DATE_RE.test(ev.date)) errors.push(`${where} : date "${ev.date}" invalide (AAAA, AAAA-MM ou AAAA-MM-JJ)`)
  if (ev.endDate && !DATE_RE.test(ev.endDate)) errors.push(`${where} : endDate "${ev.endDate}" invalide`)
  if (ev.date && ev.endDate && toNum(ev.endDate) < toNum(ev.date)) errors.push(`${where} : endDate antérieure à date`)
  if (ev.category && !cats[ev.category]) errors.push(`${where} : catégorie "${ev.category}" inconnue (${Object.keys(cats).join(', ')})`)

  if (ev.coords !== null && ev.coords !== undefined) {
    const [lat, lon] = Array.isArray(ev.coords) ? ev.coords : []
    if (typeof lat !== 'number' || typeof lon !== 'number') errors.push(`${where} : coords doit être [latitude, longitude] ou null`)
    else if (lat < -23.5 || lat > -18.5 || lon < 158 || lon > 169) warnings.push(`${where} : coords [${lat}, ${lon}] hors de l'archipel (inversion lat/lon ?)`)
  }
  if (!ev.sources?.length) warnings.push(`${where} : aucune source`)
  for (const s of ev.sources || []) {
    if (typeof s === 'object' && s.url && !/^https?:\/\//.test(s.url)) errors.push(`${where} : URL de source invalide "${s.url}"`)
  }
  for (const v of ev.videos || []) {
    const url = typeof v === 'string' ? v : v?.url
    if (!url || !/^https?:\/\//.test(url)) errors.push(`${where} : URL de vidéo invalide "${url}"`)
  }
  if (ev.image && !ev.image.url) errors.push(`${where} : image sans "url"`)
  if (ev.image && !ev.image.credit) warnings.push(`${where} : image sans crédit`)
})

// Tribus (facultatif)
let tribuCount = 0
try {
  const tdata = JSON.parse(readFileSync(new URL('../public/data/tribus.json', import.meta.url), 'utf8'))
  const tids = new Set()
  for (const [i, t] of (tdata.tribus || []).entries()) {
    const where = `tribu #${i + 1} (${t.id || 'sans id'})`
    if (!t.id || tids.has(t.id)) errors.push(`${where} : "id" manquant ou en double`)
    tids.add(t.id)
    for (const f of ['nom', 'commune', 'aire']) if (!t[f]) errors.push(`${where} : champ "${f}" manquant`)
    const [lat, lon] = Array.isArray(t.coords) ? t.coords : []
    if (typeof lat !== 'number' || typeof lon !== 'number') errors.push(`${where} : coords doit être [latitude, longitude]`)
    else if (lat < -23.5 || lat > -18.5 || lon < 158 || lon > 169) warnings.push(`${where} : coords hors de l'archipel (inversion lat/lon ?)`)
    tribuCount++
  }
} catch (e) {
  if (e.code !== 'ENOENT') errors.push(`tribus.json invalide : ${e.message}`)
}

warnings.forEach((w) => console.warn(`⚠ ${w}`))
if (errors.length) {
  errors.forEach((e) => console.error(`✖ ${e}`))
  console.error(`\n${errors.length} erreur(s) — corrigez le fichier avant de publier.`)
  process.exit(1)
}
console.log(`✔ ${ids.size} événements valides, ${Object.keys(cats).length} catégories, ${(data.periods || []).length} périodes, ${tribuCount} tribus.`)
