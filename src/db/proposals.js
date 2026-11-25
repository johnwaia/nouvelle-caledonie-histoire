/*
 * Demandes de modification proposées par les visiteurs.
 * Partagé par le site (formulaire), le service de réception (worker/) et l'administration.
 *
 * Demande : { type, action, targetId, targetName, changes, before, sourceEdits, text, date, source, comment, author }
 *  - action « modification » : changes = nouvelles valeurs des champs, before = valeurs vues par le visiteur
 *    sourceEdits = [{ before, after }] : sources corrigées, ou supprimées si after est absent
 *  - action « creation » (événement seulement) : event = nouvelle fiche complète, sans identifiant ;
 *    targetId = identifiant souhaité, tiré du titre
 *  - action « ajout » : text = informations à ajouter (date facultative pour une tribu)
 */
import { checkEvent } from './checks.js'
import { slug } from '../utils/text.js'

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
export const ACTION_LABELS = { ajout: 'Ajout d’informations', modification: 'Modification', creation: 'Nouvel événement' }
export const STATUS_LABELS = { en_attente: 'En attente', publiee: 'Publiée' }
const MAX_SOURCE_EDITS = 50
const MAX_LINKS = 20
const LIMITS = { name: 200, field: 8000, label: 400, url: 1000, date: 40, comment: 2000, author: 200 }

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

// Une source est reconnue par son contenu : sa position peut changer avant la publication.
export const sameSource = (a, b) => a?.label === b?.label && (a?.url || '') === (b?.url || '')

function cleanSourceEdits(edits) {
  if (!Array.isArray(edits)) return []
  return edits.slice(0, MAX_SOURCE_EDITS).flatMap((edit) => {
    const before = cleanSource(edit?.before)
    const after = cleanSource(edit?.after)
    if (!before || sameSource(before, after)) return []
    return [after ? { before, after } : { before }]
  })
}

const EVENT_REQUIRED = { title: 'Titre', date: 'Date', category: 'Catégorie', place: 'Texte du lieu', description: 'Description' }
const isHttp = (url) => /^https?:\/\//.test(url)
const orUndefined = (v) => v || undefined

// Image d'un nouvel événement : seulement un lien (un visiteur n'envoie pas de fichier).
function cleanImage(image) {
  const url = clean(image?.url, LIMITS.url)
  if (!url) return undefined
  const source = clean(image.source, LIMITS.url)
  if (!isHttp(url)) throw new Error("Le lien de l'image doit commencer par https://")
  if (source && !isHttp(source)) throw new Error("La page d'origine de l'image doit commencer par https://")
  return { url, alt: orUndefined(clean(image.alt, LIMITS.label)), credit: orUndefined(clean(image.credit, LIMITS.label)), source: orUndefined(source) }
}
const cleanLinks = (list, cleanLink) => (Array.isArray(list) ? list.slice(0, MAX_LINKS).map(cleanLink).filter(Boolean) : [])
function cleanVideo(video) {
  const label = clean(video?.label, LIMITS.label)
  const url = clean(video?.url, LIMITS.url)
  if (!label && !url) return undefined
  if (!isHttp(url)) throw new Error('Le lien de la vidéo doit commencer par https://')
  return { url, ...(label && { label }) }
}

function cleanEvent(raw) {
  const logo = clean(raw?.logo, LIMITS.name)
  if (logo && !/^images\/logos\/[^/\\]+$/.test(logo)) throw new Error('Logo inconnu')
  const event = {
    title: clean(raw?.title, LIMITS.name),
    date: clean(raw?.date, LIMITS.date),
    endDate: orUndefined(clean(raw?.endDate, LIMITS.date)),
    dateLabel: orUndefined(clean(raw?.dateLabel, LIMITS.name)),
    category: clean(raw?.category, LIMITS.name),
    approx: raw?.approx === true || undefined,
    auSud: raw?.auSud === true || undefined,
    place: clean(raw?.place, LIMITS.name),
    coords: Array.isArray(raw?.coords) ? raw.coords : null,
    description: clean(raw?.description, LIMITS.field),
    logo: orUndefined(logo),
    image: cleanImage(raw?.image),
    sources: cleanLinks(raw?.sources, cleanSource),
    videos: cleanLinks(raw?.videos, cleanVideo),
  }
  const missing = Object.keys(EVENT_REQUIRED).find((f) => !event[f])
  if (missing) throw new Error(`Le champ « ${EVENT_REQUIRED[missing]} » est obligatoire.`)
  return event
}

function cleanCreation(raw) {
  if (raw.type !== 'events') throw new Error('Demande invalide')
  const event = cleanEvent(raw.event)
  const targetId = slug(event.title).slice(0, 80).replace(/-$/, '') || 'evenement'
  const { errors } = checkEvent({ id: targetId, ...event })
  if (errors.length) throw new Error(errors.join('\n'))
  return {
    type: raw.type,
    action: raw.action,
    targetId,
    targetName: event.title,
    event,
    comment: clean(raw.comment, LIMITS.comment),
    author: clean(raw.author, LIMITS.author),
  }
}

// Ne garde que les champs connus, aux bonnes longueurs. Lève une erreur compréhensible si la demande est invalide.
export function cleanProposal(raw) {
  const type = raw?.type
  const action = raw?.action
  if (!Object.hasOwn(PROPOSAL_FIELDS, type) || !Object.hasOwn(ACTION_LABELS, action)) throw new Error('Demande invalide')
  if (action === 'creation') return cleanCreation(raw)
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
  p.sourceEdits = cleanSourceEdits(raw.sourceEdits)
  const names = Object.keys(p.changes)
  if (!names.length && !p.sourceEdits.length && !p.source) throw new Error('Aucune modification proposée.')
  const missing = names.find((f) => PROPOSAL_FIELDS[type][f].required && !p.changes[f])
  if (missing) throw new Error(`Le champ « ${PROPOSAL_FIELDS[type][missing].label} » ne peut pas être vide.`)
  return p
}

/* ---------- Application ---------- */
const append = (text, extra) => (text ? `${text}\n\n${extra}` : extra)

function applySourceEdits(sources, edits) {
  return edits.reduce((list, { before, after }) => {
    const i = list.findIndex((s) => sameSource(s, before))
    return i < 0 ? list : list.toSpliced(i, 1, ...(after ? [after] : []))
  }, sources || [])
}

// Nouvelle fiche d'une demande de création : si l'identifiant est déjà pris, un numéro lui est ajouté.
export function createdEvent(p, events) {
  const taken = new Set(events.map((e) => e.id))
  let id = p.targetId
  for (let n = 2; taken.has(id); n++) id = `${p.targetId}-${n}`
  return { id, ...p.event }
}

// Fiche telle qu'elle serait après publication de la demande.
export function applyProposal(item, p) {
  const next = { ...item }
  if (p.action === 'modification') {
    for (const [field, value] of Object.entries(p.changes || {})) next[targetField(p.type, field)] = value || undefined
    if (p.sourceEdits?.length) next.sources = applySourceEdits(item.sources, p.sourceEdits)
  } else if (p.date) {
    next.evenements = [...(item.evenements || []), { date: p.date, texte: p.text }]
  } else {
    const field = MAIN_TEXT[p.type]
    next[targetField(p.type, field)] = append(fieldValue(p.type, item, field), p.text)
  }
  if (p.source) next.sources = [...(next.sources || []), p.source]
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
    for (const { before, after } of p.sourceEdits || []) {
      const stale = !item.sources?.some((s) => sameSource(s, before))
      rows.push({ label: 'Source', before: sourceText(before), after: after ? sourceText(after) : '', stale })
    }
  } else {
    const label = p.date ? `Événement de la tribu (${p.date})` : PROPOSAL_FIELDS[p.type][MAIN_TEXT[p.type]].label
    rows.push({ label, before: '', after: p.text, added: true })
  }
  if (p.source) rows.push({ label: 'Source', before: '', after: sourceText(p.source), added: true })
  return rows
}

// Contenu d'une demande de création, dans l'ordre du formulaire
export function describeCreation({ event }, categories) {
  const rows = [
    ['Titre', event.title],
    ['Date', event.date],
    ['Date de fin', event.endDate],
    ['Texte affiché à la place de la date', event.dateLabel],
    ['Catégorie', categories.find((c) => c.id === event.category)?.label || event.category],
    ['Date approximative', event.approx && 'Oui'],
    ['Placer sous les autres points de l’année', event.auSud && 'Oui'],
    ['Lieu', event.place],
    ['Point sur la carte', event.coords ? event.coords.join(', ') : 'Aucun (hors de l’archipel)'],
    ['Description', event.description],
    ['Logo sur la carte', event.logo?.split('/').pop()],
    ['Image', event.image && [event.image.url, event.image.alt, event.image.credit, event.image.source].filter(Boolean).join('\n')],
    ['Sources', event.sources.map(sourceText).join('\n')],
    ['Vidéos', event.videos.map(sourceText).join('\n')],
  ]
  return rows.filter(([, after]) => after).map(([label, after]) => ({ label, before: '', after, added: true }))
}
