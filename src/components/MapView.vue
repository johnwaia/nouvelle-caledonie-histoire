<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import L from 'leaflet'
import { iconFor } from '../utils/icons'

const props = defineProps({
  events: { type: Array, default: () => [] },       // événements de l'année sélectionnée
  categories: { type: Object, default: () => ({}) },
  selectedEvent: { type: Object, default: null },
  year: { type: Number, default: null },
  tribus: { type: Array, default: () => [] },       // tribus visibles pour l'année choisie (une case chacune)
  selectedTribuId: { type: String, default: null },
  communes: { type: Array, default: () => [] },     // communes à afficher
  selectedCommuneId: { type: String, default: null },
  focusTarget: { type: Object, default: null },     // { coords, zoom, key } : résultat de recherche à montrer
  aires: { type: Object, default: null },            // GeoJSON des aires coutumières à afficher (ou null)
  selectedAireId: { type: String, default: null },
  provinces: { type: Object, default: null },        // GeoJSON des provinces à afficher (ou null)
  land: { type: Object, default: null },             // GeoJSON de la terre ferme (pour garder les points hors de la mer)
  selectedProvinceId: { type: String, default: null },
})
const emit = defineEmits(['select', 'select-tribu', 'select-commune', 'select-aire', 'select-province'])

const el = ref(null)
// L'objet Leaflet ne doit pas être réactif : variables simples.
let map = null
let layer = null
let tribusLayer = null
const tribuMarkers = new Map()
let communesLayer = null
const communeMarkers = new Map()
let resizeObserver = null
let prevIds = new Set()
let lastSignature = ''
let lastYear = null
const FADE_MS = 280

const NC_BOUNDS = L.latLngBounds([-22.9, 163.5], [-19.5, 168.3])

const offMap = computed(() => props.events.filter((e) => !e.coords))
const onMapCount = computed(() => props.events.length - offMap.value.length)
const wideScreen = window.innerWidth > 760

/*
 * Fond de carte : les tuiles Esri « Light Gray » sont recolorées à la volée.
 * Les terres (gris très clair) deviennent vertes ; la mer (gris bleuté plus sombre) ne change pas.
 */
const ESRI = 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/'
const LAND = [139, 190, 112] // vert des terres
const SEA_L = 212 // luminosité max de la mer
const LAND_L = 236 // luminosité min des terres
const GreenLandLayer = L.GridLayer.extend({
  createTile(coords, done) {
    const tile = document.createElement('canvas')
    const size = this.getTileSize()
    tile.width = size.x
    tile.height = size.y
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const ctx = tile.getContext('2d', { willReadFrequently: true })
      ctx.drawImage(img, 0, 0, size.x, size.y)
      try {
        const data = ctx.getImageData(0, 0, size.x, size.y)
        const px = data.data
        for (let i = 0; i < px.length; i += 4) {
          const l = (px[i] + px[i + 1] + px[i + 2]) / 3
          const t = Math.min(1, Math.max(0, (l - SEA_L) / (LAND_L - SEA_L)))
          if (!t) continue
          const k = (l / 239) * t // garde les nuances (limites, reliefs)
          px[i] = px[i] * (1 - t) + LAND[0] * k
          px[i + 1] = px[i + 1] * (1 - t) + LAND[1] * k
          px[i + 2] = px[i + 2] * (1 - t) + LAND[2] * k
        }
        ctx.putImageData(data, 0, 0)
      } catch {
        /* tuile sans CORS : on la laisse telle quelle */
      }
      done(null, tile)
    }
    img.onerror = (err) => done(err, tile)
    img.src = `${ESRI}World_Light_Gray_Base/MapServer/tile/${coords.z}/${coords.y}/${coords.x}`
    return tile
  },
})

/* Icône de tribu : une case. */
const CASE_IMG = import.meta.env.BASE_URL + 'images/case_kanak_icone.png'
const tribuIcon = L.divIcon({
  className: 'tribu-icon',
  html: `<span class="tribu"><img class="tribu-case" src="${CASE_IMG}" alt=""></span>`,
  iconSize: [26, 22],
  iconAnchor: [13, 19],
})

/*
 * Crédits de la carte : un petit bouton « i » qui affiche les mentions obligatoires
 * (conditions d'Esri, licence ODbL d'OpenStreetMap, source DITTT pour les tribus).
 */
const CREDITS =
  'Fond de carte © <a href="https://www.esri.com" target="_blank" rel="noopener">Esri</a>, HERE, Garmin' +
  ' · © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">contributeurs OpenStreetMap</a>' +
  ' · Tribus : Gouvernement de la Nouvelle-Calédonie / D.I.T.T.T.' +
  ' · <a href="https://leafletjs.com" target="_blank" rel="noopener">Leaflet</a>'
function addCreditsControl() {
  const Credits = L.Control.extend({
    options: { position: 'bottomleft' },
    onAdd() {
      const box = L.DomUtil.create('div', 'map-credits')
      box.innerHTML =
        '<button type="button" class="map-credits-btn" aria-expanded="false" aria-label="Crédits de la carte" title="Crédits de la carte">i</button>' +
        `<div class="map-credits-text" hidden>${CREDITS}</div>`
      const btn = box.querySelector('button')
      const text = box.querySelector('div')
      const toggle = (open) => {
        text.hidden = !open
        btn.setAttribute('aria-expanded', String(open))
      }
      btn.addEventListener('click', () => toggle(text.hidden))
      map.on('click movestart', () => toggle(false)) // se referme dès qu'on touche la carte
      L.DomEvent.disableClickPropagation(box)
      L.DomEvent.disableScrollPropagation(box)
      return box
    },
  })
  new Credits().addTo(map)
}

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ESCAPES[c])

onMounted(() => {
  map = L.map(el.value, {
    zoomSnap: 0.25,
    minZoom: 6,
    maxZoom: 16,
    maxBounds: NC_BOUNDS.pad(1.5),
    attributionControl: false, // remplacée par le bouton « i » des crédits (obligatoires : Esri, OSM, DITTT)
  })
  addCreditsControl()

  // Fond de carte épuré (Esri « Light Gray Canvas », terres recolorées en vert) + principaux noms de lieux.
  new GreenLandLayer({
    maxZoom: 16,
  }).addTo(map)
  L.tileLayer(ESRI + 'World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}', { maxZoom: 16 }).addTo(map)

  // Les tribus sont sous les points d'événements (volet dédié, juste en dessous des marqueurs).
  map.createPane('tribus').style.zIndex = 580
  tribusLayer = L.layerGroup().addTo(map)
  syncTribus()

  // Aires coutumières : sous tous les marqueurs, au-dessus du fond de carte.
  map.createPane('aires').style.zIndex = 350
  map.createPane('aires-labels').style.zIndex = 560
  map.getPane('aires-labels').style.pointerEvents = 'none'
  syncAires()
  syncProvinces()

  // Communes : étiquettes au-dessus des tribus, sous les points d'événements.
  map.createPane('communes').style.zIndex = 590
  communesLayer = L.layerGroup().addTo(map)
  syncCommunes()

  map.fitBounds(NC_BOUNDS)
  layer = L.layerGroup().addTo(map)
  render()
  map.on('zoomend', replacePins)

  // Tant que l'utilisateur n'a pas manipulé la carte, on recadre l'archipel entier
  // à chaque redimensionnement (apparition de la frise, rotation d'écran…).
  let userMoved = false
  for (const evt of ['mousedown', 'touchstart', 'wheel', 'keydown']) {
    el.value.addEventListener(evt, () => (userMoved = true), { once: true, passive: true })
  }
  resizeObserver = new ResizeObserver(() => {
    map.invalidateSize()
    if (!userMoved) map.fitBounds(NC_BOUNDS)
  })
  resizeObserver.observe(el.value)
})

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  map?.remove()
})

/* ---------- Placement des points sur la terre ferme ---------- */
// Drapeaux : logo planté par le pied de sa hampe (position du pied dans l'image, en fraction de sa taille).
const FLAG_FOOT = [0.2, 0.93]
const isFlag = (e) => !!e.logo && e.logo.includes('drapeau')
const pinSize = (e) => {
  if (isFlag(e)) return 42
  return e.logo ? 34 : 28
}

// Point dans un polygone GeoJSON (anneaux [lon, lat]), par la méthode du rayon.
function inRing(lon, lat, ring) {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]
    const [xj, yj] = ring[j]
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}
function inPolygon(lon, lat, rings) {
  return inRing(lon, lat, rings[0]) && !rings.slice(1).some((hole) => inRing(lon, lat, hole))
}
// Terre ferme = intérieur des provinces (contours qui suivent le littoral).
// Index calculé une seule fois : chaque polygone avec son rectangle englobant, pour n'examiner
// en détail que les quelques polygones autour du point (plus de 2 000 îles et îlots au total).
let landIndex = null
function buildLandIndex(geojson) {
  const index = []
  for (const f of geojson?.features || []) {
    const g = f.geometry
    for (const rings of g.type === 'MultiPolygon' ? g.coordinates : [g.coordinates]) {
      let minX = Infinity
      let minY = Infinity
      let maxX = -Infinity
      let maxY = -Infinity
      for (const [x, y] of rings[0]) {
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
      index.push({ minX, minY, maxX, maxY, rings })
    }
  }
  return index
}
const landCache = new Map() // résultats déjà calculés (point arrondi à ~10 m)
function isOnLand(latlng) {
  if (!props.land) return true // contours pas encore chargés : on ne bloque rien
  landIndex ??= buildLandIndex(props.land)
  const key = `${latlng.lat.toFixed(4)},${latlng.lng.toFixed(4)}`
  if (landCache.has(key)) return landCache.get(key)
  const { lat, lng } = latlng
  const result = landIndex.some(
    (p) => lng >= p.minX && lng <= p.maxX && lat >= p.minY && lat <= p.maxY && inPolygon(lng, lat, p.rings),
  )
  if (landCache.size > 20000) landCache.clear()
  landCache.set(key, result)
  return result
}

// Décalages (en pixels) des n points d'un même lieu : en couronne, sans tomber dans la mer.
function placeOnLand(coords, n) {
  const center = map.latLngToContainerPoint(coords)
  const onLand = ([dx, dy]) => isOnLand(map.containerPointToLatLng(center.add([dx, dy])))
  const radius = n > 1 ? 14 + n * 4 : 0
  const wanted = Array.from({ length: n }, (_, i) => {
    const a = -Math.PI / 2 + (2 * Math.PI * i) / n
    return [radius * Math.cos(a), radius * Math.sin(a)]
  })
  if (!props.land || wanted.every(onLand)) return wanted

  // Positions de repli sur la terre : couronnes successives autour du lieu, puis le lieu lui-même.
  const candidates = [[0, 0]]
  for (const r of [radius || 16, (radius || 16) + 16, (radius || 16) + 32, (radius || 16) + 50]) {
    for (let k = 0; k < 24; k++) {
      const a = (2 * Math.PI * k) / 24
      candidates.push([r * Math.cos(a), r * Math.sin(a)])
    }
  }
  const land = candidates.filter(onLand)
  const taken = []
  return wanted.map((w) => {
    if (onLand(w) && taken.every((t) => Math.hypot(t[0] - w[0], t[1] - w[1]) > 22)) {
      taken.push(w)
      return w
    }
    const free = land
      .filter((c) => taken.every((t) => Math.hypot(t[0] - c[0], t[1] - c[1]) > 22))
      .sort((a, b) => Math.hypot(a[0] - w[0], a[1] - w[1]) - Math.hypot(b[0] - w[0], b[1] - w[1]))
    const pick = free[0] || w // aucune place libre à terre : position d'origine
    taken.push(pick)
    return pick
  })
}

function render() {
  if (!map) return
  const items = props.events.filter((e) => e.coords).map((e) => ({ e }))
  const selId = props.selectedEvent?.id
  const signature = items.map((i) => i.e.id).join('|') + '#' + selId
  if (signature === lastSignature) return
  lastSignature = signature

  // Changement d'année : les anciens points s'effacent en fondu pendant que les nouveaux apparaissent.
  const yearChanged = props.year !== lastYear
  lastYear = props.year
  if (yearChanged && layer.getLayers().length) {
    const old = layer
    old.eachLayer((m) => {
      m.closeTooltip()
      m.getElement()?.classList.add('pin-leaving')
    })
    setTimeout(() => map?.removeLayer(old), FADE_MS)
    layer = L.layerGroup().addTo(map)
    prevIds = new Set()
  } else {
    layer.clearLayers()
  }

  // Les événements situés au même endroit sont disposés en couronne autour du point,
  // en restant sur la terre ferme.
  const groups = new Map()
  for (const it of items) {
    const key = it.e.coords.map((n) => n.toFixed(3)).join(',')
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(it)
  }

  const nextIds = new Set()
  for (const group of groups.values()) {
    const offsets = placeOnLand(group[0].e.coords, group.length)
    group.forEach((it, i) => {
      const [dx, dy] = offsets[i]
      const selected = it.e.id === selId
      const fresh = !prevIds.has(it.e.id)
      const flag = isFlag(it.e)
      const cls = [
        'pin',
        it.e.logo && 'pin-logo',
        flag && 'pin-flag',
        selected && 'selected',
        fresh && (yearChanged ? 'entering' : 'fresh'),
      ]
        .filter(Boolean)
        .join(' ')
      const color = props.categories[it.e.category]?.color || '#555'
      const size = pinSize(it.e)
      // Point d'ancrage : centre du rond, ou pied de la hampe pour un drapeau (planté dans le sol)
      const [ax, ay] = flag ? [size * FLAG_FOOT[0], size * FLAG_FOOT[1]] : [size / 2, size / 2]

      const icon = L.divIcon({
        className: 'pin-icon',
        // Logo de l'événement (selon sa catégorie) dans un rond de la couleur de la catégorie
        html: `<span class="${cls}" style="--c:${color}">${
          it.e.logo ? `<img src="${esc(it.e.logo)}" alt="">` : iconFor(it.e.category)
        }</span>`,
        iconSize: [size, size],
        iconAnchor: [ax - dx, ay - dy],
      })
      const marker = L.marker(it.e.coords, {
        icon,
        keyboard: true,
        alt: it.e.title,
        zIndexOffset: selected ? 1000 : 0,
      })
      marker.bindTooltip(
        `<strong>${esc(it.e.title)}</strong><br><span>${esc(it.e.dateText)} · ${esc(it.e.place)}</span>`,
        { direction: 'top', offset: [dx, dy - (flag ? size * 0.85 : 14)], className: 'pin-tooltip' },
      )
      marker.on('click', () => emit('select', it.e.id))
      marker.addTo(layer)
      nextIds.add(it.e.id)
    })
  }
  prevIds = nextIds
}

watch(() => [props.events, props.selectedEvent, props.categories, props.year], render)
// Le décalage en pixels change de sens géographique avec le zoom : on replace les points.
function replacePins() {
  lastSignature = ''
  render()
}
watch(
  () => props.land,
  () => {
    landIndex = null // nouveaux contours : index et cache à refaire
    landCache.clear()
    replacePins()
  },
)
/* ---------- Zones colorées : aires coutumières et provinces ---------- */
// Point où écrire le nom d'une zone : centre de sa plus grande partie (et non du rectangle
// englobant toutes ses îles, qui tombe souvent en mer).
function labelPoint(lyr) {
  const parts = lyr.feature.geometry.type === 'MultiPolygon' ? lyr.getLatLngs() : [lyr.getLatLngs()]
  let best = null
  let bestArea = -1
  for (const part of parts) {
    const bounds = L.latLngBounds(part[0] || part)
    const area = (bounds.getNorth() - bounds.getSouth()) * (bounds.getEast() - bounds.getWest())
    if (area > bestArea) [best, bestArea] = [bounds, area]
  }
  return best ? best.getCenter() : lyr.getBounds().getCenter()
}

// Dessine un découpage (GeoJSON) : polygones colorés, nom au centre, clic → fiche.
function zoneLayer(geojson, selectedId, eventName) {
  const group = L.layerGroup()
  const shapes = L.geoJSON(geojson, {
    pane: 'aires',
    style: (f) => ({
      color: f.properties.couleur,
      weight: f.properties.id === selectedId ? 3 : 1.5,
      fillColor: f.properties.couleur,
      fillOpacity: f.properties.id === selectedId ? 0.45 : 0.25,
    }),
    onEachFeature: (f, lyr) => {
      lyr.on('click', () => emit(eventName, f.properties.id))
      lyr.on('mouseover', () => lyr.setStyle({ fillOpacity: 0.4 }))
      lyr.on('mouseout', () => shapes.resetStyle(lyr))
      L.tooltip({ permanent: true, direction: 'center', className: 'aire-label', pane: 'aires-labels' })
        .setLatLng(labelPoint(lyr))
        .setContent(esc(f.properties.nom))
        .addTo(group)
    },
  })
  shapes.addTo(group)
  return group.addTo(map)
}

let airesLayer = null
function syncAires() {
  if (!map) return
  if (airesLayer) map.removeLayer(airesLayer)
  airesLayer = props.aires ? zoneLayer(props.aires, props.selectedAireId, 'select-aire') : null
}
watch(() => [props.aires, props.selectedAireId], syncAires)

let provincesLayer = null
function syncProvinces() {
  if (!map) return
  if (provincesLayer) map.removeLayer(provincesLayer)
  provincesLayer = props.provinces ? zoneLayer(props.provinces, props.selectedProvinceId, 'select-province') : null
}
watch(() => [props.provinces, props.selectedProvinceId], syncProvinces)

/* ---------- Tribus ---------- */
// Ajoute / retire les cases selon l'année : les nouvelles tribus apparaissent avec une petite animation.
function syncTribus() {
  if (!map) return
  const wanted = new Map(props.tribus.filter((t) => Array.isArray(t.coords)).map((t) => [t.id, t]))
  for (const [id, m] of tribuMarkers) {
    if (!wanted.has(id)) {
      tribusLayer.removeLayer(m)
      tribuMarkers.delete(id)
    }
  }
  for (const [id, t] of wanted) {
    if (tribuMarkers.has(id)) continue
    const marker = L.marker(t.coords, { pane: 'tribus', icon: tribuIcon, keyboard: true, alt: `Tribu de ${t.nom}` })
    marker.bindTooltip(`<strong>Tribu de ${esc(t.nom)}</strong><br><span>${esc(t.commune)}${t.aire ? ' · aire ' + esc(t.aire) : ''}</span>`, {
      direction: 'top',
      offset: [0, -16],
      className: 'pin-tooltip',
    })
    marker.on('click', () => emit('select-tribu', id))
    marker.addTo(tribusLayer)
    tribuMarkers.set(id, marker)
  }
  highlightTribu()
}
function highlightTribu() {
  for (const [id, m] of tribuMarkers) m.getElement()?.classList.toggle('active', id === props.selectedTribuId)
}
watch(() => props.tribus, syncTribus)
watch(() => props.selectedTribuId, highlightTribu)

/* ---------- Communes ---------- */
function syncCommunes() {
  if (!map) return
  const wanted = new Map(props.communes.filter((c) => Array.isArray(c.coords)).map((c) => [c.id, c]))
  for (const [id, m] of communeMarkers) {
    if (!wanted.has(id)) {
      communesLayer.removeLayer(m)
      communeMarkers.delete(id)
    }
  }
  for (const [id, c] of wanted) {
    if (communeMarkers.has(id)) continue
    const marker = L.marker(c.coords, {
      pane: 'communes',
      icon: L.divIcon({
        className: 'commune-icon',
        html: `<span class="commune-pin"></span><span class="commune-label">${esc(c.nom)}</span>`,
        iconSize: [12, 12],
        iconAnchor: [6, 6],
      }),
      keyboard: true,
      alt: `Commune de ${c.nom}`,
    })
    marker.on('click', () => emit('select-commune', id))
    marker.addTo(communesLayer)
    communeMarkers.set(id, marker)
  }
  highlightCommune()
}
function highlightCommune() {
  for (const [id, m] of communeMarkers) m.getElement()?.classList.toggle('active', id === props.selectedCommuneId)
}
watch(() => props.communes, syncCommunes)
watch(() => props.selectedCommuneId, highlightCommune)

// Résultat du moteur de recherche : on centre la carte dessus.
watch(
  () => props.focusTarget?.key,
  () => {
    const t = props.focusTarget
    if (!map || !t?.coords) return
    map.flyTo(t.coords, t.zoom, { duration: 0.9 })
    // Le panneau d'information couvre la droite (ordinateur) ou le bas (mobile) : on décale la vue.
    map.once('moveend', () => {
      const size = map.getSize()
      if (window.innerWidth > 760) map.panBy([Math.min(210, size.x / 4), 0])
      else map.panBy([0, Math.round(size.y * 0.3)])
    })
  },
)

// Recentre la carte si l'événement choisi est hors champ.
watch(
  () => props.selectedEvent,
  (ev) => {
    if (!map || !ev?.coords) return
    if (!map.getBounds().pad(-0.15).contains(ev.coords)) {
      map.flyTo(ev.coords, Math.max(map.getZoom(), 8.5), { duration: 0.8 })
    }
  },
)
</script>

<template>
  <div class="map-wrap">
    <div ref="el" class="map" aria-label="Carte de la Nouvelle-Calédonie"></div>

    <details v-if="offMap.length" class="map-panel map-offmap" :open="wideScreen">
      <summary>Hors de l'archipel ({{ offMap.length }})</summary>
      <button v-for="e in offMap" :key="e.id" class="offmap-item" @click="emit('select', e.id)">
        <span class="swatch" :style="{ background: categories[e.category]?.color }"></span>
        <span>{{ e.title }}<small>{{ e.dateText }} · {{ e.place }}</small></span>
      </button>
    </details>

    <div v-if="events.length && !onMapCount" class="map-empty">
      Cette année, {{ events.length > 1 ? 'les événements se sont déroulés' : "l'événement s'est déroulé" }} hors de l'archipel.
    </div>
  </div>
</template>
