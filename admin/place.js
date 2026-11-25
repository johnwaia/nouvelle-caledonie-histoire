/*
 * Champ « Lieu » d'un événement : on choisit une commune ou une tribu, et le point se place seul sur la carte.
 * « Autre lieu » couvre les points précis (clic sur la carte) et les événements hors de l'archipel.
 */
import { el, norm } from './dom.js'

const TILES = 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}'
const BOUNDS = [[-22.8, 163.4], [-19.4, 168.3]]
const KINDS = [
  ['commune', 'Commune'],
  ['tribu', 'Tribu'],
  ['autre', 'Autre lieu'],
]

// Lieux proposés : nom affiché dans la liste, texte du lieu, coordonnées
function choices(kind, state) {
  if (kind === 'commune') return state.communes.map((c) => ({ label: c.nom, place: c.nom, coords: c.coords }))
  if (kind === 'tribu') {
    return state.tribus.map((t) => ({ label: `${t.nom} (${t.commune})`, place: `Tribu de ${t.nom}, ${t.commune}`, coords: t.coords }))
  }
  return []
}

// Retrouve le choix fait à l'origine : mêmes coordonnées et même texte.
function findChoice(value, state) {
  if (!value.coords) return null
  for (const kind of ['commune', 'tribu']) {
    const choice = choices(kind, state).find((c) => c.coords[0] === value.coords[0] && c.coords[1] === value.coords[1] && c.place === value.place)
    if (choice) return { kind, choice }
  }
  return null
}
const round = (n) => Math.round(n * 1e5) / 1e5

export function placeField(value, { L, state, isNew }) {
  const found = findChoice(value, state)
  let kind = found?.kind || (isNew ? 'commune' : 'autre')
  let coords = value.coords || null

  /* ---------- Éléments ---------- */
  const radios = KINDS.map(([id, label]) => {
    const radio = el('input', { type: 'radio', name: 'place-kind', value: id, checked: id === kind })
    radio.onchange = () => setKind(id)
    return el('label', { className: 'check' }, radio, label)
  })
  const list = el('datalist', { id: 'place-choices' })
  const search = el('input', { value: found?.choice.label ?? '', autocomplete: 'off' })
  search.setAttribute('list', 'place-choices')
  const searchLabel = el('span')
  const searchBox = el('label', {}, searchLabel, search)
  const place = el('input', { value: value.place ?? '' })
  const status = el('p', { className: 'hint' })
  const mapBox = el('div', { className: 'place-map' })
  const clear = el('button', { type: 'button', textContent: "Hors de l'archipel (aucun point)" })

  /* ---------- Carte ---------- */
  const map = L.map(mapBox, { zoomSnap: 0.25, minZoom: 5, maxZoom: 14, attributionControl: false, scrollWheelZoom: false })
  L.tileLayer(TILES, { maxZoom: 14 }).addTo(map)
  map.fitBounds(BOUNDS)
  const marker = L.marker([0, 0], { icon: L.divIcon({ className: 'place-marker', iconSize: [22, 22], iconAnchor: [11, 11] }), keyboard: false })
  // La carte est créée avant d'être affichée : elle se recadre quand sa taille est connue.
  new ResizeObserver(() => {
    map.invalidateSize()
    focusMap()
  }).observe(mapBox)
  map.on('click', (e) => {
    if (kind !== 'autre') return
    setCoords([round(e.latlng.lat), round(e.latlng.lng)])
    mapBox.dispatchEvent(new Event('input', { bubbles: true }))
  })

  function focusMap() {
    if (coords) map.setView(coords, Math.max(map.getZoom(), 8))
    else map.fitBounds(BOUNDS)
  }
  function setCoords(next) {
    coords = next
    if (coords) marker.setLatLng(coords).addTo(map)
    else marker.remove()
    showStatus()
  }
  function showStatus() {
    const where = coords ? `Point placé : ${coords[0]}, ${coords[1]}.` : 'Aucun point sur la carte.'
    status.textContent = kind === 'autre' ? `${where} Cliquez sur la carte pour le placer.` : where
  }

  /* ---------- Choix ---------- */
  const currentChoice = () => choices(kind, state).find((c) => norm(c.label) === norm(search.value.trim()))
  function applyChoice() {
    const choice = currentChoice()
    setCoords(choice ? choice.coords : null)
    if (choice) place.value = choice.place
    focusMap()
  }
  function showKind() {
    const named = kind !== 'autre'
    searchBox.hidden = !named
    clear.hidden = named
    searchLabel.textContent = kind === 'tribu' ? 'Tribu' : 'Commune'
    search.placeholder = kind === 'tribu' ? 'Saisir le nom de la tribu…' : 'Saisir le nom de la commune…'
    list.replaceChildren(...choices(kind, state).map((c) => el('option', { value: c.label })))
    showStatus()
  }
  function setKind(next) {
    kind = next
    showKind()
    if (kind === 'autre') return
    search.value = ''
    applyChoice()
  }
  search.addEventListener('input', applyChoice)
  clear.onclick = () => {
    setCoords(null)
    focusMap()
    mapBox.dispatchEvent(new Event('input', { bubbles: true }))
  }
  showKind()
  setCoords(coords)

  return {
    node: el(
      'fieldset',
      {},
      el('legend', { textContent: 'Lieu' }),
      el('div', { className: 'radios' }, ...radios),
      list,
      searchBox,
      mapBox,
      status,
      clear,
      el('label', {}, 'Texte du lieu ', el('small', { textContent: '(affiché dans la fiche)' }), place),
    ),
    get() {
      if (kind !== 'autre' && !currentChoice()) throw new Error(`Choisissez une ${kind} dans la liste.`)
      return { place: place.value.trim() || undefined, coords }
    },
  }
}
