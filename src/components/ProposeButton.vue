<script setup>
import { computed, nextTick, reactive, ref } from 'vue'
import { PROPOSAL_FIELDS, TYPE_LABELS, cleanProposal, fieldValue } from '../db/proposals'

/*
 * Bouton « Proposer une modification » d'une fiche, et son formulaire.
 * La demande est envoyée à l'administration ; rien n'est publié directement.
 */
const props = defineProps({
  type: { type: String, required: true }, // events | tribus | communes
  item: { type: Object, required: true },
})
const API = import.meta.env.VITE_DEMANDES_URL
const fields = PROPOSAL_FIELDS[props.type]
const name = computed(() => props.item.title || props.item.nom)

const dialog = ref(null)
const isOpen = ref(false)
const sending = ref(false)
const sent = ref(false)
const error = ref('')
const form = reactive({})

function reset() {
  Object.assign(form, {
    action: 'ajout',
    values: Object.fromEntries(Object.keys(fields).map((f) => [f, fieldValue(props.type, props.item, f)])),
    text: '',
    date: '',
    sources: (props.item.sources || []).map((s) => ({ before: { label: s.label, url: s.url }, label: s.label || '', url: s.url || '', removed: false })),
    source: { label: '', url: '' },
    comment: '',
    author: '',
    website: '',
  })
  sent.value = false
  error.value = ''
}
async function open() {
  reset()
  isOpen.value = true
  await nextTick()
  dialog.value.showModal()
}
function close() {
  isOpen.value = false
}

const isSourceChanged = (s) => s.removed || s.label.trim() !== (s.before.label || '') || s.url.trim() !== (s.before.url || '')

function buildProposal() {
  const p = {
    type: props.type,
    action: form.action,
    targetId: props.item.id,
    targetName: name.value,
    source: form.source,
    comment: form.comment,
    author: form.author,
  }
  if (form.action === 'ajout') return { ...p, text: form.text, date: form.date }
  // Seuls les champs réellement modifiés sont envoyés.
  const before = (f) => fieldValue(props.type, props.item, f)
  const changed = Object.keys(fields).filter((f) => form.values[f].trim() !== before(f).trim())
  return {
    ...p,
    changes: Object.fromEntries(changed.map((f) => [f, form.values[f]])),
    before: Object.fromEntries(changed.map((f) => [f, before(f)])),
    sourceEdits: form.sources.filter(isSourceChanged).map((s) => (s.removed ? { before: s.before } : { before: s.before, after: { label: s.label, url: s.url } })),
  }
}
async function post(proposal) {
  let res
  try {
    res = await fetch(`${API}/demandes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...proposal, website: form.website }),
    })
  } catch {
    throw new Error('Le service est injoignable. Vérifiez votre connexion et réessayez.')
  }
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || "La demande n'a pas pu être envoyée.")
}
async function submit() {
  error.value = ''
  sending.value = true
  try {
    await post(cleanProposal(buildProposal()))
    sent.value = true
  } catch (e) {
    error.value = e.message
  } finally {
    sending.value = false
  }
}
</script>

<template>
  <div v-if="API" class="propose">
    <button type="button" class="propose-btn" @click="open">Proposer un ajout ou une modification</button>

    <Teleport to="body">
      <!-- Les touches (Échap, flèches) ne doivent pas agir sur la fiche située dessous -->
      <dialog v-if="isOpen" ref="dialog" class="propose-dialog" aria-labelledby="propose-title" @close="close" @keydown.stop>
        <div v-if="sent">
          <h2 id="propose-title">Merci !</h2>
          <p>
            Votre demande concernant « {{ name }} » a été envoyée. Elle sera relue par l'administration avant toute
            publication.
          </p>
          <div class="propose-actions"><button type="button" class="propose-send" autofocus @click="close">Fermer</button></div>
        </div>

        <form v-else @submit.prevent="submit">
          <h2 id="propose-title">{{ TYPE_LABELS[type] }} : {{ name }}</h2>
          <fieldset class="propose-choice">
            <legend>Que souhaitez-vous faire ?</legend>
            <label><input v-model="form.action" type="radio" value="ajout" /> Ajouter des informations</label>
            <label><input v-model="form.action" type="radio" value="modification" /> Modifier la fiche</label>
          </fieldset>

          <template v-if="form.action === 'ajout'">
            <label v-if="type === 'tribus'">
              Date <small>(facultative : pour un événement de la tribu)</small>
              <input v-model="form.date" maxlength="40" placeholder="ex. 1917" />
            </label>
            <label>
              Informations à ajouter
              <textarea v-model="form.text" rows="6" maxlength="8000" required></textarea>
            </label>
          </template>
          <template v-else>
            <label v-for="(f, key) in fields" :key="key">
              {{ f.label }}
              <textarea v-if="f.long" v-model="form.values[key]" rows="7" maxlength="8000" :required="f.required"></textarea>
              <input v-else v-model="form.values[key]" maxlength="300" :required="f.required" />
            </label>

            <fieldset v-if="form.sources.length">
              <legend>Sources actuelles</legend>
              <div v-for="(s, i) in form.sources" :key="i" class="propose-source" :class="{ removed: s.removed }">
                <input v-model="s.label" maxlength="400" required :disabled="s.removed" :aria-label="`Source ${i + 1} : titre`" />
                <input v-model="s.url" type="url" maxlength="1000" placeholder="https://…" :disabled="s.removed" :aria-label="`Source ${i + 1} : lien`" />
                <button type="button" :aria-label="`${s.removed ? 'Rétablir' : 'Supprimer'} la source ${i + 1}`" @click="s.removed = !s.removed">
                  {{ s.removed ? 'Rétablir' : 'Supprimer' }}
                </button>
              </div>
            </fieldset>
          </template>

          <fieldset>
            <legend>{{ form.action === 'ajout' ? 'Source' : 'Nouvelle source' }} <small>(recommandée)</small></legend>
            <label>Titre ou nom <input v-model="form.source.label" maxlength="400" placeholder="livre, article, personne…" /></label>
            <label>Lien <input v-model="form.source.url" type="url" maxlength="1000" placeholder="https://…" /></label>
          </fieldset>
          <label>Message à l'administration <small>(facultatif)</small><textarea v-model="form.comment" rows="2" maxlength="2000"></textarea></label>
          <label>
            Votre nom ou contact <small>(facultatif, visible seulement par l'administration)</small>
            <input v-model="form.author" maxlength="200" />
          </label>
          <input v-model="form.website" class="propose-trap" name="website" tabindex="-1" autocomplete="off" aria-hidden="true" />

          <p class="propose-note">Votre proposition sera relue avant d'être publiée.</p>
          <p v-if="error" class="propose-error" role="alert">{{ error }}</p>
          <div class="propose-actions">
            <button type="button" @click="close">Annuler</button>
            <button class="propose-send" :disabled="sending">{{ sending ? 'Envoi…' : 'Envoyer la demande' }}</button>
          </div>
        </form>
      </dialog>
    </Teleport>
  </div>
</template>
