// Onglet « Demande de modifications » : détail d'une demande, avec les différences mises en évidence.
import { ACTION_LABELS, STATUS_LABELS, TYPE_LABELS, describeCreation, describeProposal } from '../src/db/proposals.js'
import { el } from './dom.js'

const MAX_WORDS = 1500 // au-delà, la comparaison mot à mot serait trop lente
export const formatDate = (iso) => new Date(iso).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' })
export const demandeTitle = (d) => `${d.action === 'creation' ? ACTION_LABELS.creation : TYPE_LABELS[d.type]} : ${d.targetName}`
export const demandeSummary = (d) => [formatDate(d.createdAt), ACTION_LABELS[d.action], STATUS_LABELS[d.status]].join(' · ')

/* ---------- Comparaison mot à mot ---------- */
// Longueur de la plus longue suite commune, à partir de chaque position
function commonLengths(a, b) {
  const table = Array.from({ length: a.length + 1 }, () => new Uint16Array(b.length + 1))
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      table[i][j] = a[i] === b[j] ? table[i + 1][j + 1] + 1 : Math.max(table[i + 1][j], table[i][j + 1])
    }
  }
  return table
}
function diffWords(before, after) {
  const a = before.split(/(\s+)/)
  const b = after.split(/(\s+)/)
  if (a.length > MAX_WORDS || b.length > MAX_WORDS) return [['del', before], ['ins', after]]
  const table = commonLengths(a, b)
  const parts = []
  const push = (kind, text) => {
    const last = parts.at(-1)
    if (last?.[0] === kind) last[1] += text
    else parts.push([kind, text])
  }
  let i = 0
  let j = 0
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      push('same', a[i++])
      j++
    } else if (table[i + 1][j] >= table[i][j + 1]) push('del', a[i++])
    else push('ins', b[j++])
  }
  if (i < a.length) push('del', a.slice(i).join(''))
  if (j < b.length) push('ins', b.slice(j).join(''))
  return parts
}
function diffNode({ before, after, added }) {
  const box = el('p', { className: 'diff' })
  if (added || !before) box.append(el('ins', { textContent: after }))
  else if (!after) box.append(el('del', { textContent: before }))
  else {
    for (const [kind, text] of diffWords(before, after)) {
      box.append(kind === 'same' ? text : el(kind, { textContent: text }))
    }
  }
  return box
}

/* ---------- Détail ---------- */
const BADGES = { add: 'Ajout', edit: 'Modifié', remove: 'Supprimé' }
function changeKind(row) {
  if (row.added || !row.before) return 'add'
  return row.after ? 'edit' : 'remove'
}
function changeNode(row) {
  const kind = changeKind(row)
  return el(
    'section',
    { className: 'change' },
    el('h3', {}, row.label, ' ', el('span', { className: `badge ${kind}`, textContent: BADGES[kind] })),
    row.stale && el('p', { className: 'warning', textContent: 'Attention : ce contenu a été modifié ou supprimé depuis l’envoi de la demande.' }),
    diffNode(row),
  )
}
const info = (label, value) => value && el('p', {}, el('strong', { textContent: `${label} : ` }), value)

// Contenu à afficher. Une demande publiée est comparée à ce que le visiteur avait vu, car la fiche contient déjà le changement.
function demandeRows(d, item, categories) {
  if (d.action === 'creation') return describeCreation(d, categories)
  if (!item) return []
  const seen = d.status === 'en_attente' ? item : { ...item, ...d.before, histoireManuelle: d.before?.histoire, sources: d.sourceEdits?.map((s) => s.before) }
  return describeProposal(seen, d)
}

// item : fiche actuelle (absente si elle a été supprimée) ; duplicate : événement portant déjà le titre proposé
export function demandeNode(d, item, { categories, duplicate, onPublish, onDelete }) {
  const pending = d.status === 'en_attente'
  const creation = d.action === 'creation'
  const publishable = pending && (creation || item)
  const remove = el('button', { type: 'button', className: 'danger', textContent: 'Supprimer', onclick: onDelete })
  const publish = el('button', { type: 'button', className: 'primary', textContent: 'Publier', onclick: onPublish })
  return el(
    'div',
    { className: 'demande' },
    el('h2', { textContent: demandeTitle(d) }),
    info('Reçue le', formatDate(d.createdAt)),
    info('Nature', ACTION_LABELS[d.action]),
    info('Statut', STATUS_LABELS[d.status]),
    info('Proposée par', d.author),
    info('Message', d.comment),
    !creation && !item && el('p', { className: 'warning', textContent: 'Cette fiche n’existe plus : la demande ne peut pas être publiée.' }),
    creation && pending && duplicate && el('p', { className: 'warning', textContent: `Attention : un événement du même nom existe déjà (${duplicate.date}).` }),
    publishable && !creation && el('p', { className: 'hint', textContent: 'En vert : ce qui est ajouté. En rouge barré : ce qui est retiré.' }),
    ...demandeRows(d, item, categories).map(changeNode),
    el('div', { className: 'actions' }, publishable && publish, remove),
  )
}
