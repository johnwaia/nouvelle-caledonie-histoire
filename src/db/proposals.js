/*
 * Demandes de modification proposées par les visiteurs.
 * Partagé par le site (formulaire), le service de réception (worker/) et l'administration.
 *
 * Demande : { type, action, targetId, targetName, changes, before, text, date, source, comment, author }
 *  - action « modification » : changes = nouvelles valeurs des champs, before = valeurs vues par le visiteur
 *  - action « ajout » : text = informations à ajouter (date facultative pour une tribu)
 */
export const PROPOSAL_FIELDS = {
  events: {
    title: { label: 'Titre', required: true },
    date: { label: 'Date (AAAA, AAAA-MM ou AAAA-MM-JJ)', required: true },
    endDate: { label: 'Date de fin' },
    place: { label: 'Lieu', required: true },
    description: { label: 'Description', long: true, required: true },
  },
  tribus: {
    nom: { label: 'Nom', required: true },
    nomLocal: { label: 'Nom local' },
    origines: { label: 'Origines', long: true },
  },
  communes: {
    resume: { label: 'Présentation', long: true },
    histoire: { label: 'Histoire', long: true },
  },
}
export const TYPE_LABELS = { events: 'Événement', tribus: 'Tribu', communes: 'Commune' }
export const ACTION_LABELS = { ajout: 'Ajout d’informations', modification: 'Modification' }
export const STATUS_LABELS = { en_attente: 'En attente', publiee: 'Publiée' }
const LIMITS = { name: 200, field: 8000, label: 200, url: 1000, date: 40, comment: 2000, author: 200 }

// L'histoire d'une commune est affichée (et modifiée) dans sa version manuelle si elle existe.
export function fieldValue(type, item, field) {
  if (type === 'communes' && field === 'histoire') return item.histoireManuelle || item.histoire || ''
  return item[field] ?? ''
}
const targetField = (type, field) => (type === 'communes' && field === 'histoire' ? 'histoireManuelle' : field)
const MAIN_TEXT = { events: 'description', tribus: 'origines', communes: 'histoire' }

/* ---------- Vérification ---------- */
const clean = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '')

function cleanFields(type, values) {
  const out = {}
  for (const field of Object.keys(PROPOSAL_FIELDS[type])) {
    if (typeof values?.[field] === 'string') out[field] = clean(values[field], LIMITS.field)
  }
  return out
}
function cleanSource(source) {
  const label = clean(source?.label, LIMITS.label)
  const url = clean(source?.url, LIMITS.url)
  if (!label && !url) return undefined
  if (url && !/^https?:\/\//.test(url)) throw new Error('Le lien de la source doit commencer par https://')
  return { label: label || url, ...(url && { url }) }
}

// Ne garde que les champs connus, aux bonnes longueurs. Lève une erreur compréhensible si la demande est invalide.
export function cleanProposal(raw) {
  const type = raw?.type
  const action = raw?.action
  if (!Object.hasOwn(PROPOSAL_FIELDS, type) || !Object.hasOwn(ACTION_LABELS, action)) throw new Error('Demande invalide')
  const p = {
    type,
    action,
    targetId: clean(raw.targetId, LIMITS.name),
    targetName: clean(raw.targetName, LIMITS.name),
    source: cleanSource(raw.source),
    comment: clean(raw.comment, LIMITS.comment),
    author: clean(raw.author, LIMITS.author),
  }
  if (!/^[a-z0-9-]+$/.test(p.targetId) || !p.targetName) throw new Error('Demande invalide')
  if (action === 'ajout') {
    p.text = clean(raw.text, LIMITS.field)
    p.date = type === 'tribus' ? clean(raw.date, LIMITS.date) : ''
    if (p.text.length < 10) throw new Error('Décrivez les informations à ajouter (10 caractères au minimum).')
    return p
  }
  p.changes = cleanFields(type, raw.changes)
  p.before = cleanFields(type, raw.before)
  const names = Object.keys(p.changes)
  if (!names.length && !p.source) throw new Error('Aucune modification proposée.')
  const missing = names.find((f) => PROPOSAL_FIELDS[type][f].required && !p.changes[f])
  if (missing) throw new Error(`Le champ « ${PROPOSAL_FIELDS[type][missing].label} » ne peut pas être vide.`)
  return p
}

/* ---------- Application ---------- */
const append = (text, extra) => (text ? `${text}\n\n${extra}` : extra)

// Fiche telle qu'elle serait après publication de la demande.
export function applyProposal(item, p) {
  const next = { ...item }
  if (p.action === 'modification') {
    for (const [field, value] of Object.entries(p.changes || {})) next[targetField(p.type, field)] = value || undefined
  } else if (p.date) {
    next.evenements = [...(item.evenements || []), { date: p.date, texte: p.text }]
  } else {
    const field = MAIN_TEXT[p.type]
    next[targetField(p.type, field)] = append(fieldValue(p.type, item, field), p.text)
  }
  if (p.source) next.sources = [...(item.sources || []), p.source]
  return next
}

const sourceText = (s) => [...new Set([s.label, s.url])].filter(Boolean).join(' — ')

// Différences à montrer : { label, before, after, added, stale }. « stale » : le champ a changé depuis la demande.
export function describeProposal(item, p) {
  const rows = []
  if (p.action === 'modification') {
    for (const [field, after] of Object.entries(p.changes || {})) {
      const before = fieldValue(p.type, item, field)
      const stale = p.before?.[field] !== undefined && p.before[field] !== before.trim()
      rows.push({ label: PROPOSAL_FIELDS[p.type][field].label, before, after, stale })
    }
  } else {
    const label = p.date ? `Événement de la tribu (${p.date})` : PROPOSAL_FIELDS[p.type][MAIN_TEXT[p.type]].label
    rows.push({ label, before: '', after: p.text, added: true })
  }
  if (p.source) rows.push({ label: 'Source', before: '', after: sourceText(p.source), added: true })
  return rows
}
