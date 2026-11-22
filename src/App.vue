<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import MapView from './components/MapView.vue'
import TimelineBar from './components/TimelineBar.vue'
import EventModal from './components/EventModal.vue'
import TribuPanel from './components/TribuPanel.vue'
import CommunePanel from './components/CommunePanel.vue'
import SearchBox from './components/SearchBox.vue'
import { parseDate, toDecimal, formatEventDate } from './utils/dates'

/*
 * Sources de données : par défaut le fichier public/data/events.json.
 * Pour ajouter d'autres flux (ex. un fichier d'actualités hébergé ailleurs, un export de CMS),
 * définir VITE_EVENTS_URLS="data/events.json,https://exemple.nc/actualites.json" dans .env.local.
 * Les fichiers sont fusionnés ; un événement portant le même "id" remplace le précédent.
 */
const SOURCES = (import.meta.env.VITE_EVENTS_URLS || 'data/events.json')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)
const resolveUrl = (u) => (/^https?:\/\//.test(u) ? u : import.meta.env.BASE_URL + u.replace(/^\//, ''))

const loading = ref(true)
const error = ref('')
const categories = ref({})
const periods = ref([])
const events = ref([])

const selectedYear = ref(null)
const caseIcon = import.meta.env.BASE_URL + 'images/case_kanak_icone.png'
const showPast = ref(false)
const selectedId = ref(null)
const tribus = ref([])
const selectedTribuId = ref(null)
const showTribus = ref(false) // affichage des tribus : bouton dans l'en-tête, indépendant des années
const communes = ref([])
const selectedCommuneId = ref(null)
const showCommunes = ref(false)
// Résultat choisi dans le moteur de recherche : la carte n'affiche alors que lui.
const focus = ref(null) // { type: 'tribu' | 'commune', id }

// Tribus (public/data/tribus.json) : facultatives, une erreur de chargement ne bloque pas le site.
async function loadTribus() {
  try {
    const res = await fetch(resolveUrl('data/tribus.json'), { cache: 'no-cache' })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    tribus.value = ((await res.json()).tribus || []).filter((t) => t.id && Array.isArray(t.coords))
  } catch (e) {
    console.warn('Tribus non chargées :', e.message)
  }
}

// Communes (public/data/communes.json) : facultatives elles aussi.
async function loadCommunes() {
  try {
    const res = await fetch(resolveUrl('data/communes.json'), { cache: 'no-cache' })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    communes.value = ((await res.json()).communes || []).filter((c) => c.id && Array.isArray(c.coords))
  } catch (e) {
    console.warn('Communes non chargées :', e.message)
  }
}

function normalize(raw) {
  const start = parseDate(raw.date)
  const t = toDecimal(start)
  if (!raw.id || Number.isNaN(t)) {
    console.warn('Événement ignoré (id ou date invalide) :', raw)
    return null
  }
  const tEnd = raw.endDate ? toDecimal(parseDate(raw.endDate)) : null
  return {
    ...raw,
    t,
    year: start.y,
    tEnd: Number.isNaN(tEnd) ? null : tEnd,
    coords: Array.isArray(raw.coords) && raw.coords.length === 2 ? raw.coords : null,
    dateText: formatEventDate(raw),
    sources: (raw.sources || []).map((s) => (typeof s === 'string' ? { label: s } : s)),
    videos: (raw.videos || []).map((v) => (typeof v === 'string' ? { url: v } : v)),
    // Image locale (« images/evenements/… ») ou distante (https://…)
    image: raw.image?.url ? { ...raw.image, url: resolveUrl(raw.image.url) } : raw.image,
  }
}

async function load() {
  try {
    const files = await Promise.all(
      SOURCES.map(async (u) => {
        const res = await fetch(resolveUrl(u), { cache: 'no-cache' })
        if (!res.ok) throw new Error(`${u} : HTTP ${res.status}`)
        return res.json()
      }),
    )
    categories.value = Object.assign({}, ...files.map((f) => f.categories || {}))
    periods.value = files.find((f) => f.periods?.length)?.periods || []
    const byId = new Map()
    for (const f of files) for (const raw of f.events || []) {
      const ev = normalize(raw)
      if (ev) byId.set(ev.id, ev)
    }
    events.value = [...byId.values()].sort((a, b) => a.t - b.t)
  } catch (e) {
    error.value = `Impossible de charger les événements (${e.message}).`
  } finally {
    loading.value = false
  }
}

/* ---------- Années ---------- */

// Une entrée par année contenant au moins un événement.
const years = computed(() => {
  const counts = new Map()
  for (const e of events.value) counts.set(e.year, (counts.get(e.year) || 0) + 1)
  return [...counts].map(([year, count]) => ({ year, count })).sort((a, b) => a.year - b.year)
})
const visibleEvents = computed(() => events.value.filter((e) => e.year === selectedYear.value))
const pastEvents = computed(() =>
  showPast.value ? events.value.filter((e) => e.year < selectedYear.value) : [],
)

// Si l'année choisie n'existe plus (données rechargées), on passe à la plus proche.
watch(years, (list) => {
  if (!list.length || list.some((y) => y.year === selectedYear.value)) return
  const target = selectedYear.value ?? -Infinity
  selectedYear.value = list.reduce((best, y) =>
    Math.abs(y.year - target) < Math.abs(best.year - target) ? y : best,
  ).year
})
const yearIndex = computed(() => years.value.findIndex((y) => y.year === selectedYear.value))
function stepYear(delta) {
  const y = years.value[Math.max(0, Math.min(years.value.length - 1, yearIndex.value + delta))]
  if (y) selectedYear.value = y.year
}

/* ---------- Tribus, communes et recherche ---------- */
// Sans recherche : les boutons de l'en-tête affichent toutes les tribus / communes.
// Avec un résultat de recherche : seul cet élément est affiché.
const visibleTribus = computed(() => {
  if (focus.value) return focus.value.type === 'tribu' ? tribus.value.filter((t) => t.id === focus.value.id) : []
  return showTribus.value ? tribus.value : []
})
const visibleCommunes = computed(() => {
  if (focus.value) return focus.value.type === 'commune' ? communes.value.filter((c) => c.id === focus.value.id) : []
  return showCommunes.value ? communes.value : []
})
const selectedTribu = computed(() => visibleTribus.value.find((t) => t.id === selectedTribuId.value) || null)
const selectedCommune = computed(() => visibleCommunes.value.find((c) => c.id === selectedCommuneId.value) || null)
const plainName = (s) => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
const tribuCountOf = (commune) => tribus.value.filter((t) => plainName(t.commune) === plainName(commune.nom)).length
const focusTarget = computed(() => {
  if (!focus.value) return null
  const list = focus.value.type === 'tribu' ? tribus.value : communes.value
  const item = list.find((x) => x.id === focus.value.id)
  return item ? { coords: item.coords, zoom: focus.value.type === 'tribu' ? 11 : 9.5, key: focus.value.type + item.id } : null
})
watch([visibleTribus, visibleCommunes], () => {
  if (selectedTribuId.value && !selectedTribu.value) selectedTribuId.value = null
  if (selectedCommuneId.value && !selectedCommune.value) selectedCommuneId.value = null
})
function selectTribu(id) {
  selectedId.value = null
  selectedCommuneId.value = null
  selectedTribuId.value = id
}
function selectCommune(id) {
  selectedId.value = null
  selectedTribuId.value = null
  selectedCommuneId.value = id
}
function chooseFromSearch(f) {
  focus.value = f
  if (f.type === 'tribu') selectTribu(f.id)
  else selectCommune(f.id)
}
function clearFocus() {
  focus.value = null
  selectedTribuId.value = null
  selectedCommuneId.value = null
}
// Les boutons de l'en-tête quittent le mode « un seul résultat ».
function toggleTribus() {
  focus.value = null
  showTribus.value = !showTribus.value
}
function toggleCommunes() {
  focus.value = null
  showCommunes.value = !showCommunes.value
}

/* ---------- Sélection & navigation ---------- */
const selected = computed(() => events.value.find((e) => e.id === selectedId.value) || null)
const selectedIndex = computed(() => events.value.findIndex((e) => e.id === selectedId.value))
const select = (id) => {
  selectedTribuId.value = null
  selectedCommuneId.value = null
  selectedId.value = id
}
// L'année suit l'événement ouvert (lien partagé, Précédent/Suivant, encart hors archipel…).
watch(selected, (ev) => {
  if (ev) selectedYear.value = ev.year
})
const close = () => (selectedId.value = null)
function go(delta) {
  const next = events.value[selectedIndex.value + delta]
  if (next) selectedId.value = next.id
}

// Liens partageables : #evenement=<id>, #tribu=<id> ou #commune=<id>
function readHash() {
  const ev = location.hash.match(/evenement=([^&]+)/)
  const tr = location.hash.match(/tribu=([^&]+)/)
  const co = location.hash.match(/commune=([^&]+)/)
  selectedId.value = ev ? decodeURIComponent(ev[1]) : null
  if (tr) {
    showTribus.value = true // un lien vers une tribu active l'affichage des tribus
    selectTribu(decodeURIComponent(tr[1]))
  } else if (co) {
    showCommunes.value = true
    selectCommune(decodeURIComponent(co[1]))
  } else if (!ev) {
    selectedTribuId.value = null
    selectedCommuneId.value = null
  }
}
watch([selectedId, selectedTribuId, selectedCommuneId], ([id, tribuId, communeId]) => {
  const url = id
    ? `#evenement=${encodeURIComponent(id)}`
    : tribuId
      ? `#tribu=${encodeURIComponent(tribuId)}`
      : communeId
        ? `#commune=${encodeURIComponent(communeId)}`
        : location.pathname + location.search
  if (url.startsWith('#') ? location.hash !== url : location.hash) history.replaceState(null, '', url)
})

function onKey(e) {
  if (selectedTribu.value || selectedCommune.value) {
    if (e.key === 'Escape') {
      selectedTribuId.value = null
      selectedCommuneId.value = null
    }
    return
  }
  if (!selected.value) {
    // Flèches du clavier : année précédente / suivante (sauf dans un champ ou sur la carte,
    // où Leaflet les utilise pour se déplacer).
    if (e.altKey || e.ctrlKey || e.metaKey || e.target.closest?.('input, textarea, select, .map')) return
    const delta = { ArrowLeft: -1, ArrowRight: 1, Home: -Infinity, End: Infinity }[e.key]
    if (!delta) return
    e.preventDefault()
    if (Number.isFinite(delta)) stepYear(delta)
    else stepYear(delta < 0 ? -years.value.length : years.value.length)
    return
  }
  if (e.key === 'Escape') close()
  else if (e.key === 'ArrowLeft') go(-1)
  else if (e.key === 'ArrowRight') go(1)
}

onMounted(async () => {
  await Promise.all([load(), loadTribus(), loadCommunes()])
  selectedYear.value = years.value[0]?.year ?? null
  readHash()
  window.addEventListener('hashchange', readHash)
  window.addEventListener('keydown', onKey)
})
onBeforeUnmount(() => {
  window.removeEventListener('hashchange', readHash)
  window.removeEventListener('keydown', onKey)
})
</script>

<template>
  <div class="app">
    <header class="app-header">
      <div class="brand">
        <h1>KANAKY</h1>
        <p>Une histoire en carte, des premiers peuplements à aujourd'hui</p>
      </div>
      <div class="header-actions">
        <button
          class="tribus-toggle"
          :class="{ on: showTribus }"
          :aria-pressed="showTribus"
          :disabled="!tribus.length"
          @click="toggleTribus"
        >
          <img :src="caseIcon" alt="" />
          {{ showTribus ? 'Masquer les tribus' : 'Afficher les tribus' }}
        </button>
        <button
          class="tribus-toggle"
          :class="{ on: showCommunes }"
          :aria-pressed="showCommunes"
          :disabled="!communes.length"
          @click="toggleCommunes"
        >
          <span class="commune-dot" aria-hidden="true"></span>
          {{ showCommunes ? 'Masquer les communes' : 'Afficher les communes' }}
        </button>
        <label class="toggle">
          <input v-model="showPast" type="checkbox" />
          <span>Afficher les années précédentes</span>
        </label>
      </div>
    </header>

    <main class="app-map">
      <MapView
        :events="visibleEvents"
        :past-events="pastEvents"
        :categories="categories"
        :selected-event="selected"
        :year="selectedYear"
        :tribus="visibleTribus"
        :selected-tribu-id="selectedTribuId"
        :communes="visibleCommunes"
        :selected-commune-id="selectedCommuneId"
        :focus-target="focusTarget"
        @select="select"
        @select-tribu="selectTribu"
        @select-commune="selectCommune"
      />
      <SearchBox
        v-if="!loading && !error"
        :tribus="tribus"
        :communes="communes"
        :focus="focus"
        @choose="chooseFromSearch"
        @clear="clearFocus"
      />
      <div v-if="loading" class="app-status">Chargement de la chronologie…</div>
      <div v-else-if="error" class="app-status error">{{ error }}</div>
    </main>

    <TimelineBar
      v-if="!loading && !error"
      :years="years"
      :selected-year="selectedYear"
      @select-year="selectedYear = $event"
    />

    <EventModal
      v-if="selected"
      :key="selected.id"
      :event="selected"
      @close="close"
    />

    <TribuPanel
      v-if="selectedTribu"
      :key="selectedTribu.id"
      :tribu="selectedTribu"
      @close="selectedTribuId = null"
    />

    <CommunePanel
      v-if="selectedCommune"
      :key="selectedCommune.id"
      :commune="selectedCommune"
      :tribu-count="tribuCountOf(selectedCommune)"
      @close="selectedCommuneId = null"
    />
  </div>
</template>
