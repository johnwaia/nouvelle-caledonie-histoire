// Outils d'affichage de l'administration : éléments, messages, barre de progression.
export const $ = (id) => document.getElementById(id)

export function el(tag, props = {}, ...children) {
  const node = Object.assign(document.createElement(tag), props)
  node.append(...children.filter((c) => c !== null && c !== undefined && c !== false))
  return node
}
export const norm = (s) =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
export const slug = (s) => norm(s).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

let toastTimer
export function toast(message, error = false) {
  const t = $('toast')
  t.textContent = message
  t.className = error ? 'error' : ''
  t.hidden = false
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => {
    t.hidden = true
  }, error ? 9000 : 4000)
}

/* ---------- Barre de progression ---------- */
let progressTimer
function showProgress(state, message, percent) {
  clearTimeout(progressTimer)
  const box = $('progress')
  const bar = box.querySelector('progress')
  box.hidden = false
  box.className = state
  box.querySelector('span').textContent = message
  if (percent === null) bar.removeAttribute('value') // durée inconnue : barre animée
  else bar.value = percent
}
const hideLater = (delay) => {
  progressTimer = setTimeout(() => {
    $('progress').hidden = true
  }, delay)
}
export const progress = {
  step: (message, percent = null) => showProgress('running', message, percent),
  done(message) {
    showProgress('done', `✓ ${message}`, 100)
    hideLater(5000)
  },
  fail(message) {
    showProgress('failed', `✕ ${message}`, 100)
    hideLater(9000)
  },
  // Information qui ne signale ni succès ni échec
  info(message) {
    showProgress('done', message, 100)
    hideLater(9000)
  },
}

// Lance une action asynchrone ; en cas d'échec, affiche le message d'erreur.
export function attempt(action) {
  action().catch((e) => toast(e.message, true))
}
// Même chose, avec la barre de progression ; l'action renvoie le message de fin.
export function attemptWithProgress(message, action) {
  progress.step(message)
  action().then(
    (end) => progress.done(end),
    (e) => {
      progress.fail('Échec')
      toast(e.message, true)
    },
  )
}
