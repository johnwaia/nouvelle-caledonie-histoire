<script setup>
import { computed, ref, onMounted, watch } from 'vue'
import CategoryIcon from './CategoryIcon.vue'
import ProposeButton from './ProposeButton.vue'

const props = defineProps({
  event: { type: Object, required: true },
  color: { type: String, default: '#555' }, // couleur de la catégorie (logo)
})
const emit = defineEmits(['close'])

const dialog = ref(null)
onMounted(() => dialog.value?.focus())

const paragraphs = computed(() => String(props.event.description || '').split(/\n\s*\n/).filter(Boolean))
const videos = computed(() => (props.event.videos || []).filter((v) => v?.url))

// Image principale puis images supplémentaires, en défilement horizontal.
const gallery = computed(() => [props.event.image, ...(props.event.photos || [])].filter((i) => i?.url))
const strip = ref(null)
const current = ref(0)
const onScroll = () => (current.value = Math.round(strip.value.scrollLeft / strip.value.clientWidth))
const go = (step) => strip.value.scrollTo({ left: (current.value + step) * strip.value.clientWidth, behavior: 'smooth' })
watch(
  () => props.event.id,
  () => {
    current.value = 0
    if (strip.value) strip.value.scrollLeft = 0
  },
)
</script>

<template>
  <!-- Fermeture : bouton ×, clic à côté de la fiche ou touche Échap -->
  <div class="modal-backdrop" @click.self="emit('close')" @keydown.esc="emit('close')">
    <dialog open ref="dialog" class="modal" aria-modal="true" aria-labelledby="ev-title" tabindex="-1">
      <button class="modal-close" aria-label="Fermer" title="Fermer (Échap)" @click="emit('close')">×</button>

      <figure v-if="gallery.length" class="modal-figure">
        <div class="modal-gallery">
          <div ref="strip" class="modal-strip" @scroll.passive="onScroll">
            <div v-for="(img, i) in gallery" :key="img.url" class="modal-frame" :style="{ '--img': `url(&quot;${img.url}&quot;)` }">
              <img :src="img.url" :alt="img.alt || event.title" :loading="i ? 'lazy' : undefined" />
            </div>
          </div>
          <template v-if="gallery.length > 1">
            <button type="button" class="gallery-nav prev" aria-label="Image précédente" :disabled="current === 0" @click="go(-1)">‹</button>
            <button type="button" class="gallery-nav next" aria-label="Image suivante" :disabled="current === gallery.length - 1" @click="go(1)">›</button>
            <span class="gallery-count" aria-live="polite">{{ current + 1 }} / {{ gallery.length }}</span>
          </template>
        </div>
        <figcaption v-if="gallery[current]?.credit">
          <a v-if="gallery[current].source" :href="gallery[current].source" target="_blank" rel="noopener noreferrer">{{ gallery[current].credit }}</a>
          <template v-else>{{ gallery[current].credit }}</template>
        </figcaption>
      </figure>

      <div class="modal-body">
        <div class="ev-head">
          <img v-if="event.logo" class="ev-logo ev-logo-img" :src="event.logo" alt="" />
          <span v-else class="ev-logo" :style="{ '--c': color }"><CategoryIcon :category="event.category" /></span>
          <h2 id="ev-title">{{ event.title }}</h2>
        </div>
        <dl class="meta">
          <div><dt>Date</dt><dd class="cap">{{ event.dateText }}</dd></div>
          <div><dt>Lieu</dt><dd>{{ event.place }}</dd></div>
        </dl>
        <p v-for="(para, i) in paragraphs" :key="i">{{ para }}</p>

        <section v-if="videos.length" class="sources videos">
          <h3>Vidéos</h3>
          <ul>
            <li v-for="(v, i) in videos" :key="i">
              <a :href="v.url" target="_blank" rel="noopener noreferrer">▶ {{ v.label || v.url }}</a>
            </li>
          </ul>
        </section>

        <section v-if="event.sources?.length" class="sources">
          <h3>Sources et pour aller plus loin</h3>
          <ul>
            <li v-for="(s, i) in event.sources" :key="i">
              <a v-if="s.url" :href="s.url" target="_blank" rel="noopener noreferrer">{{ s.label }}</a>
              <span v-else>{{ s.label }}</span>
            </li>
          </ul>
        </section>

        <ProposeButton type="events" :item="event" />
      </div>
    </dialog>
  </div>
</template>
