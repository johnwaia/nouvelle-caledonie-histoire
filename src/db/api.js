/*
 * Actions de l'administration, communes à la version locale (admin/server.mjs) et en ligne (admin/online.js) :
 *   GET state · POST|PUT|DELETE <type>/<id> · POST images/<id>[?replace=1] (octets de l'image)
 */
import * as store from './write.js'
import * as checks from './checks.js'
import { readAll } from './read.js'

export const MAX_UPLOAD = 8 * 1024 * 1024

export class ApiError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

// Requêtes fixes : aucune partie de l'adresse demandée n'entre dans le texte SQL.
const TYPES = {
  events: {
    save: store.saveEvent,
    check: checks.checkEvent,
    find: 'SELECT 1 FROM events WHERE id = ?',
    remove: 'DELETE FROM events WHERE id = ?',
  },
  tribus: {
    save: store.saveTribu,
    check: checks.checkTribu,
    find: 'SELECT 1 FROM tribus WHERE id = ?',
    remove: 'DELETE FROM tribus WHERE id = ?',
  },
  communes: {
    save: store.saveCommune,
    check: checks.checkCommune,
    find: 'SELECT 1 FROM communes WHERE id = ?',
    remove: 'DELETE FROM communes WHERE id = ?',
  },
  aires: {
    save: store.saveAire,
    check: checks.checkZone,
    find: 'SELECT 1 FROM aires WHERE id = ?',
    fixed: true, // ni création ni suppression : contour nécessaire
  },
  provinces: {
    save: store.saveProvince,
    check: checks.checkZone,
    find: 'SELECT 1 FROM provinces WHERE id = ?',
    fixed: true, // ni création ni suppression : contour nécessaire
  },
  categories: {
    save: store.saveCategory,
    check: checks.checkCategory,
    find: 'SELECT 1 FROM categories WHERE id = ?',
    remove: 'DELETE FROM categories WHERE id = ?',
  },
  periods: {
    save: store.savePeriod,
    check: checks.checkPeriod,
    find: 'SELECT 1 FROM periods WHERE id = ?',
    remove: 'DELETE FROM periods WHERE id = ?',
  },
}
const IMAGES = { find: 'SELECT 1 FROM images WHERE id = ?', remove: 'DELETE FROM images WHERE id = ?' }

function state(db) {
  const data = readAll(store.reader(db))
  return {
    events: data.events,
    tribus: data.tribus,
    communes: data.communes,
    aires: data.aires.features.map((f) => f.properties),
    provinces: data.provinces.features.map((f) => f.properties),
    categories: Object.entries(data.categories).map(([id, c]) => ({ id, ...c })),
    periods: data.periods,
    images: db
      .prepare(
        `SELECT images.*, length(image_data.data) AS size,
          (SELECT count(*) FROM events WHERE logo_id = images.id OR image_id = images.id)
          + (SELECT count(*) FROM event_images WHERE image_id = images.id)
          + (SELECT count(*) FROM communes WHERE image_id = images.id) AS uses
         FROM images LEFT JOIN image_data ON image_id = images.id ORDER BY images.id`,
      )
      .all(),
  }
}

const exists = (db, type, id) => !!db.prepare(type.find).get(id)

function saveItem(db, type, item, creating) {
  const { errors, warnings } = type.check(item || {})
  if (errors.length) throw new ApiError(422, errors.join('\n'))
  if (creating && type.fixed) throw new ApiError(400, 'Impossible de créer une zone ici : son contour est nécessaire')
  const found = exists(db, type, item.id)
  if (creating && found) throw new ApiError(409, `L'identifiant « ${item.id} » existe déjà`)
  if (!creating && !found) throw new ApiError(404, 'Élément introuvable')
  store.transaction(db, () => type.save(db, item))
  return { warnings }
}

function removeItem(db, type, id) {
  if (type.fixed) throw new ApiError(400, 'Suppression impossible')
  if (!exists(db, type, id)) throw new ApiError(404, 'Élément introuvable')
  db.prepare(type.remove).run(id)
  return {}
}

function addImage(db, id, data, replace) {
  if (!data?.length) throw new ApiError(400, 'Fichier vide')
  if (data.length > MAX_UPLOAD) throw new ApiError(413, 'Fichier trop lourd (8 Mo au maximum)')
  if (!replace && exists(db, IMAGES, id)) throw new ApiError(409, `L'image « ${id} » existe déjà`)
  store.transaction(db, () => store.saveImageData(db, id, data))
  return {}
}

const IMAGE_ACTIONS = {
  POST: (db, { id, body, query }) => addImage(db, id, body, query === 'replace=1'),
  DELETE: (db, { id }) => removeItem(db, IMAGES, id),
  PUT(db, { body }) {
    store.saveImage(db, body)
    return {}
  },
}
const ITEM_ACTIONS = {
  POST: (db, { type, body }) => saveItem(db, type, body, true),
  PUT: (db, { type, body }) => saveItem(db, type, body, false),
  DELETE: (db, { type, id }) => removeItem(db, type, id),
}
const own = (o, key) => (Object.hasOwn(o, key) ? o[key] : undefined)

function findAction(method, name) {
  if (name === 'state') return method === 'GET' ? state : undefined
  if (name === 'images') return own(IMAGE_ACTIONS, method)
  return own(TYPES, name) && own(ITEM_ACTIONS, method)
}

function dispatch(db, method, path, body) {
  const [address, query] = path.split('?')
  const [name, rawId] = address.split('/')
  const action = findAction(method, name)
  if (!action) throw new ApiError(404, 'Adresse inconnue')
  return action(db, { type: own(TYPES, name), id: rawId && decodeURIComponent(rawId), query, body })
}

// Messages SQLite → messages compréhensibles
export function handle(db, method, path, body) {
  try {
    return dispatch(db, method, path, body)
  } catch (e) {
    if (/FOREIGN KEY/.test(e.message)) throw new ApiError(409, "Élément encore utilisé, ou lien vers un élément qui n'existe pas")
    if (/UNIQUE/.test(e.message)) throw new ApiError(409, 'Ce nom est déjà utilisé')
    throw e
  }
}
