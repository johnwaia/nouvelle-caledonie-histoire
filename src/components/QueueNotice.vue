<script setup>
import { computed, ref } from 'vue'
import { discard, flushQueue, queue } from '../utils/demandes'

// Demandes gardées dans le navigateur parce que le service était indisponible.
const refused = computed(() => queue.value.filter((d) => d.error))
const waiting = computed(() => queue.value.length - refused.value.length)
const busy = ref(false)
async function retry() {
  busy.value = true
  await flushQueue({ retryRefused: true })
  busy.value = false
}
</script>

<template>
  <div v-if="queue.length" class="queue-notice" role="status">
    <p v-if="waiting">
      {{ waiting > 1 ? `${waiting} demandes en attente : elles seront envoyées` : 'Une demande en attente : elle sera envoyée' }}
      automatiquement.
    </p>
    <p v-for="d in refused" :key="d.id">
      « {{ d.name }} » n'a pas été acceptée : {{ d.error }}
      <button type="button" @click="discard(d.id)">Retirer</button>
    </p>
    <button type="button" :disabled="busy" @click="retry">{{ busy ? 'Envoi…' : 'Envoyer maintenant' }}</button>
  </div>
</template>
