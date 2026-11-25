/*
 * Envoi d'une demande au service de réception (worker/). Adresse vide : les boutons de proposition sont masqués.
 * Si le service est indisponible, la demande est gardée dans le navigateur et renvoyée plus tard.
 */
import { ref } from 'vue'
import { readStored, writeStored } from './storage'

export const DEMANDES_URL = import.meta.env.VITE_DEMANDES_URL
const QUEUE = 'a-envoyer'
const TIMEOUT = 20_000
const RETRY_EVERY = 5 * 60_000

class Unavailable extends Error {}

async function post(body) {
  let res
  try {
    res = await fetch(`${DEMANDES_URL}/demandes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT),
    })
  } catch {
    throw new Unavailable('Le service est injoignable. Vérifiez votre connexion et réessayez.')
  }
  if (res.ok) return
  const { error } = await res.json().catch(() => ({}))
  const message = error || "La demande n'a pas pu être envoyée."
  // Une erreur 429 sans message vient de Cloudflare (quota), pas du service.
  if (res.status >= 500 || (res.status === 429 && !error)) throw new Unavailable(message)
  throw Object.assign(new Error(message), { later: res.status === 429 })
}

/* ---------- Demandes en attente d'envoi : { id, name, body, error } ---------- */
const stored = () => readStored(QUEUE) || []
export const queue = ref(stored())

// La liste est toujours relue : un autre onglet a pu la changer.
function update(change) {
  const next = change(stored())
  const ok = writeStored(QUEUE, next)
  if (ok) queue.value = next
  return ok
}
export const discard = (id) => update((list) => list.filter((d) => d.id !== id))

// Renvoie 'sent', ou 'queued' si la demande est gardée pour plus tard.
export async function sendDemande(proposal, website) {
  // L'identifiant évite un doublon si la demande est reçue mais que la réponse se perd.
  const body = { ...proposal, id: crypto.randomUUID(), website }
  try {
    await post(body)
    return 'sent'
  } catch (e) {
    if (e instanceof Unavailable && update((list) => [...list, { id: body.id, name: proposal.targetName, body }])) return 'queued'
    throw e
  }
}

let flushing = false
export async function flushQueue({ retryRefused = false } = {}) {
  if (flushing) return
  flushing = true
  try {
    for (const d of stored()) {
      if (d.error && !retryRefused) continue
      try {
        await post(d.body)
        discard(d.id)
      } catch (e) {
        if (e instanceof Unavailable || e.later) return
        // Refusée : le visiteur décide de réessayer ou de la retirer.
        update((list) => list.map((x) => (x.id === d.id ? { ...x, error: e.message } : x)))
      }
    }
  } finally {
    flushing = false
  }
}

export function startQueue() {
  if (!DEMANDES_URL) return
  void flushQueue()
  window.addEventListener('online', () => flushQueue())
  window.addEventListener('storage', () => {
    queue.value = stored()
  })
  setInterval(flushQueue, RETRY_EVERY)
}
