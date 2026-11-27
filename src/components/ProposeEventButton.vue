<script setup>
import { nextTick, onBeforeUnmount, reactive, ref, watch } from 'vue'
import L from 'leaflet'
import { placeField } from '../../admin/place.js'
import { cleanProposal } from '../db/proposals'
import { DEMANDES_URL as API, sendDemande } from '../utils/demandes'
import { readDraft, removeDraft, writeDraft } from '../utils/storage'

/*
 * Bouton « Ajouter un événement » de l'en-tête : même formulaire que l'administration.
 * L'événement est envoyé comme une demande ; il n'est créé que si l'administration le publie.
 */
const props = defineProps({
  categories: { type: Object, required: true }, // { id: { label } }
  communes: { type: Array, required: true },
  tribus: { type: Array, required: true },
  logos: { type: Array, required: true },
  disabled: { type: Boolean, default: false },
})
const LINK_LISTS = [
  { key: 'sources', legend: 'Sources', hint: 'recommandé' },
  { key: 'videos', legend: 'Vidéos', hint: 'facultatif' },
]

const dialog = ref(null)
const placeBox = ref(null)
const isOpen = ref(false)
const sending = ref(false)
const sent = ref('') // 'sent' ou 'queued'
const restored = ref(false) // formulaire rempli avec un brouillon
const error = ref('')
const form = reactive({})
let place = null // champ « Lieu », partagé avec l'administration

const DRAFT = 'nouvel-evenement'
const emptyLink = () => ({ label: '', url: '' })

function reset() {
  Object.assign(form, {
    event: {
      title: '',
      date: '',
      endDate: '',
      dateLabel: '',
      category: '',
      approx: false,
      auSud: false,
      description: '',
      logo: '',
      image: { url: '', alt: '', credit: '', source: '' },
      sources: [emptyLink()],
      videos: [],
    },
    comment: '',
    author: '',
    lieu: null, // lieu choisi : { place, coords }
    website: '',
  })
  sent.value = ''
  error.value = ''
}
function destroyPlace() {
  place?.destroy()
  place = null
}
function showPlace() {
  destroyPlace()
  place = placeField(form.lieu || {}, { L, state: { communes: props.communes, tribus: props.tribus }, isNew: !form.lieu })
  placeBox.value.replaceChildren(place.node)
}
function keepPlace() {
  try {
    form.lieu = place.get()
  } catch {
    form.lieu = null // choix incomplet
  }
}
// Le brouillon est enregistré à chaque modification, jusqu'à l'envoi.
watch(
  form,
  ({ website, ...data }) => {
    if (isOpen.value && !sent.value) writeDraft(DRAFT, data)
  },
  { deep: true },
)
async function open() {
  reset()
  const draft = readDraft(DRAFT)
  restored.value = !!draft
  if (draft) Object.assign(form, draft)
  await nextTick()
  isOpen.value = true
  await nextTick()
  showPlace()
  dialog.value.showModal()
}
async function startOver() {
  reset()
  restored.value = false
  await nextTick()
  showPlace()
  removeDraft(DRAFT)
}
function close() {
  destroyPlace()
  isOpen.value = false
}
onBeforeUnmount(destroyPlace)

async function submit() {
  error.value = ''
  sending.value = true
  try {
    const event = { ...form.event, ...place.get() }
    const result = await sendDemande(
      cleanProposal({ type: 'events', action: 'creation', event, comment: form.comment, author: form.author }),
      form.website,
    )
    destroyPlace()
    sent.value = result
    await nextTick()
    removeDraft(DRAFT)
  } catch (e) {
    error.value = e.message
  } finally {
    sending.value = false
  }
}
</script>

<template>
  <button v-if="API" type="button" class="tribus-toggle add-event" :disabled="disabled" @click="open">
    <span class="plus" aria-hidden="true">+</span>
    <span class="long">Ajouter un événement</span>
    <span class="short">Événement</span>
  </button>

  <Teleport to="body">
    <!-- Les touches (Échap, flèches) ne doivent pas agir sur la carte située dessous -->
    <dialog v-if="isOpen" ref="dialog" class="propose-dialog" aria-labelledby="propose-event-title" @close="close" @keydown.stop>
      <div v-if="sent">
        <h2 id="propose-event-title">Merci !</h2>
        <p v-if="sent === 'queued'">
          Le service est momentanément indisponible. Votre demande est gardée dans ce navigateur et sera envoyée
          automatiquement lors de votre passage sur le site.
        </p>
        <p v-else>
          L'événement « {{ form.event.title }} » a été envoyé. Il sera relu par l'administration avant toute publication.
        </p>
        <div class="propose-actions"><button type="button" class="propose-send" autofocus @click="close">Fermer</button></div>
      </div>

      <form v-else @submit.prevent="submit">
        <h2 id="propose-event-title">Ajouter un événement</h2>
        <p v-if="restored" class="propose-draft">
          Votre brouillon a été retrouvé. <button type="button" @click="startOver">Repartir de zéro</button>
        </p>
        <label>Titre <input v-model="form.event.title" name="title" maxlength="200" required autofocus /></label>
        <div class="propose-grid">
          <label>
            Date <small>(AAAA, AAAA-MM ou AAAA-MM-JJ)</small>
            <input v-model="form.event.date" name="date" maxlength="11" placeholder="ex. 1878-06-25" required />
          </label>
          <label>Date de fin <small>(facultatif)</small><input v-model="form.event.endDate" maxlength="11" /></label>
          <label>
            Texte affiché à la place de la date <small>(facultatif)</small>
            <input v-model="form.event.dateLabel" maxlength="200" />
          </label>
          <label>
            Catégorie
            <select v-model="form.event.category" required>
              <option value="">— choisir —</option>
              <option v-for="(c, id) in categories" :key="id" :value="id">{{ c.label }}</option>
            </select>
          </label>
          <label class="check"><input v-model="form.event.approx" type="checkbox" /> Date approximative</label>
          <label class="check"><input v-model="form.event.auSud" type="checkbox" /> Placer sous les autres points de l’année</label>
        </div>

        <div ref="placeBox" @input="keepPlace" @change="keepPlace"></div>

        <label>
          Description <small>(une ligne vide sépare les paragraphes)</small>
          <textarea v-model="form.event.description" name="description" rows="8" maxlength="8000" required></textarea>
        </label>
        <label>
          Logo sur la carte
          <select v-model="form.event.logo">
            <option value="">Icône de la catégorie</option>
            <option v-for="id in logos" :key="id" :value="id">{{ id.split('/').pop() }}</option>
          </select>
        </label>

        <fieldset>
          <legend>Image <small>(facultatif)</small></legend>
          <label>Lien de l’image <input v-model="form.event.image.url" type="url" maxlength="1000" placeholder="https://…" /></label>
          <label>Description de l’image <input v-model="form.event.image.alt" maxlength="400" /></label>
          <label>Crédit <input v-model="form.event.image.credit" maxlength="400" placeholder="auteur, licence" /></label>
          <label>Page d’origine <input v-model="form.event.image.source" type="url" maxlength="1000" placeholder="https://…" /></label>
        </fieldset>

        <fieldset v-for="{ key, legend, hint } in LINK_LISTS" :key="key">
          <legend>{{ legend }} <small>({{ hint }})</small></legend>
          <div v-for="(link, i) in form.event[key]" :key="i" class="propose-link">
            <input v-model="link.label" maxlength="400" placeholder="Libellé" :aria-label="`${legend} ${i + 1} : libellé`" />
            <input v-model="link.url" type="url" maxlength="1000" placeholder="https://…" :aria-label="`${legend} ${i + 1} : lien`" />
            <button type="button" :aria-label="`${legend} : retirer la ligne ${i + 1}`" @click="form.event[key].splice(i, 1)">×</button>
          </div>
          <button v-if="form.event[key].length < 20" type="button" @click="form.event[key].push(emptyLink())">Ajouter une ligne</button>
        </fieldset>

        <label>Message à l'administration <small>(facultatif)</small><textarea v-model="form.comment" rows="2" maxlength="2000"></textarea></label>
        <label>
          Votre nom ou contact <small>(facultatif, visible seulement par l'administration)</small>
          <input v-model="form.author" maxlength="200" />
        </label>
        <!-- Champ piège : invisible, seuls les robots le remplissent -->
        <label for="propose-event-website" class="propose-trap" aria-hidden="true">
          Ne pas remplir
          <input id="propose-event-website" v-model="form.website" name="website" tabindex="-1" autocomplete="off" />
        </label>

        <p class="propose-note">Votre événement sera relu avant d'être publié.</p>
        <p v-if="error" class="propose-error" role="alert">{{ error }}</p>
        <div class="propose-actions">
          <button type="button" @click="close">Annuler</button>
          <button type="submit" class="propose-send" :disabled="sending">{{ sending ? 'Envoi…' : 'Envoyer la demande' }}</button>
        </div>
      </form>
    </dialog>
  </Teleport>
</template>
