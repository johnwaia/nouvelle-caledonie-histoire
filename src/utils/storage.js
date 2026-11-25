// Enregistrement dans le navigateur du visiteur. Il peut être refusé (navigation privée, stockage plein).
const PREFIX = 'kanaky:'
const DRAFT_DAYS = 30
const DAY = 86_400_000

export function readStored(key) {
  try {
    return JSON.parse(localStorage.getItem(PREFIX + key))
  } catch {
    return null
  }
}
// Renvoie false si l'enregistrement est impossible.
export function writeStored(key, value) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value))
    return true
  } catch {
    return false
  }
}
export function removeStored(key) {
  try {
    localStorage.removeItem(PREFIX + key)
  } catch {
    // rien à effacer
  }
}

/* ---------- Brouillons des formulaires ---------- */
const draftKey = (id) => `brouillon:${id}`
export const writeDraft = (id, data) => writeStored(draftKey(id), { savedAt: Date.now(), data })
export const removeDraft = (id) => removeStored(draftKey(id))
export function readDraft(id) {
  const draft = readStored(draftKey(id))
  if (draft && Date.now() - draft.savedAt < DRAFT_DAYS * DAY) return draft.data
  removeDraft(id)
  return null
}
