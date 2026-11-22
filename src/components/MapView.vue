<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import L from 'leaflet'

const props = defineProps({
  events: { type: Array, default: () => [] },       // événements de l'année sélectionnée
  pastEvents: { type: Array, default: () => [] },   // événements des années précédentes (estompés)
  categories: { type: Object, default: () => ({}) },
  selectedEvent: { type: Object, default: null },
  year: { type: Number, default: null },
  tribus: { type: Array, default: () => [] },       // tribus visibles pour l'année choisie (une case chacune)
  selectedTribuId: { type: String, default: null },
})
const emit = defineEmits(['select', 'select-tribu'])

const el = ref(null)
// L'objet Leaflet ne doit pas être réactif : variables simples.
let map = null
let layer = null
let tribusLayer = null
const tribuMarkers = new Map()
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

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ESCAPES[c])

onMounted(() => {
  map = L.map(el.value, { zoomSnap: 0.25, minZoom: 6, maxZoom: 16, maxBounds: NC_BOUNDS.pad(1.5) })

  // Fond de carte épuré (Esri « Light Gray Canvas », terres recolorées en vert) + principaux noms de lieux.
  new GreenLandLayer({
    attribution: 'Fond de carte &copy; Esri, HERE, Garmin, &copy; contributeurs OpenStreetMap · Tribus : Gouvernement de la Nouvelle-Calédonie / DITTT',
    maxZoom: 16,
  }).addTo(map)
  L.tileLayer(ESRI + 'World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}', { maxZoom: 16 }).addTo(map)

  // Les tribus sont sous les points d'événements (volet dédié, juste en dessous des marqueurs).
  map.createPane('tribus').style.zIndex = 580
  tribusLayer = L.layerGroup().addTo(map)
  syncTribus()

  map.fitBounds(NC_BOUNDS)
  layer = L.layerGroup().addTo(map)
  render()

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

function render() {
  if (!map) return
  const items = [
    ...props.pastEvents.filter((e) => e.coords).map((e) => ({ e, past: true })),
    ...props.events.filter((e) => e.coords).map((e) => ({ e, past: false })),
  ]
  const selId = props.selectedEvent?.id
  const signature = items.map((i) => i.e.id + (i.past ? '~' : '')).join('|') + '#' + selId
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

  // Les événements situés au même endroit sont disposés en couronne autour du point.
  const groups = new Map()
  for (const it of items) {
    const key = it.e.coords.map((n) => n.toFixed(3)).join(',')
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(it)
  }

  const nextIds = new Set()
  for (const group of groups.values()) {
    const n = group.length
    group.forEach((it, i) => {
      const radius = n > 1 ? 10 + n * 1.5 : 0
      const angle = -Math.PI / 2 + (2 * Math.PI * i) / n
      const dx = radius * Math.cos(angle)
      const dy = radius * Math.sin(angle)
      const selected = it.e.id === selId
      const fresh = !it.past && !prevIds.has(it.e.id)
      const cls = ['pin', it.past && 'past', selected && 'selected', fresh && (yearChanged ? 'entering' : 'fresh')]
        .filter(Boolean)
        .join(' ')
      const color = props.categories[it.e.category]?.color || '#555'

      const icon = L.divIcon({
        className: 'pin-icon',
        html: `<span class="${cls}" style="--c:${color}"></span>`,
        iconSize: [20, 20],
        iconAnchor: [10 - dx, 10 - dy],
      })
      const marker = L.marker(it.e.coords, {
        icon,
        keyboard: true,
        alt: it.e.title,
        zIndexOffset: selected ? 1000 : it.past ? -500 : 0,
      })
      marker.bindTooltip(
        `<strong>${esc(it.e.title)}</strong><br><span>${esc(it.e.dateText)} · ${esc(it.e.place)}</span>`,
        { direction: 'top', offset: [dx, dy - 10], className: 'pin-tooltip' },
      )
      marker.on('click', () => emit('select', it.e.id))
      marker.addTo(layer)
      if (!it.past) nextIds.add(it.e.id)
    })
  }
  prevIds = nextIds
}

watch(() => [props.events, props.pastEvents, props.selectedEvent, props.categories, props.year], render)

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
