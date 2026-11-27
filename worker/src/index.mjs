/*
 * Réception des demandes de modification (Cloudflare Worker + base D1).
 *   POST   /demandes        visiteur : envoie une demande
 *   GET    /demandes        administration : liste
 *   PATCH  /demandes/<id>   administration : { status }
 *   DELETE /demandes/<id>   administration : supprime
 * L'administration s'identifie avec un jeton GitHub, transmis à GitHub pour vérification et jamais conservé.
 */
import { cleanProposal } from '../../src/db/proposals.js'

const MAX_BODY = 60_000
const MAX_PER_HOUR = 5 // par visiteur
const MAX_PENDING = 1000
const HOUR = 3_600_000
const UUID_RE = /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/

class HttpError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

const originAllowed = (origin, env) => env.ALLOWED_ORIGINS.split(',').includes(origin)

function corsHeaders(request, env) {
  const origin = request.headers.get('Origin')
  if (!origin || !originAllowed(origin, env)) return {}
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Max-Age': '3600',
    Vary: 'Origin',
  }
}

// Empreinte de l'adresse du visiteur : sert seulement à limiter le nombre d'envois.
async function hashIp(request, env) {
  const data = new TextEncoder().encode(env.IP_SALT + (request.headers.get('CF-Connecting-IP') || ''))
  const digest = await crypto.subtle.digest('SHA-256', data)
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

async function requireAdmin(request, env) {
  const authorization = request.headers.get('Authorization') || ''
  if (!/^Bearer \S+$/.test(authorization)) throw new HttpError(401, 'Connexion nécessaire')
  const res = await fetch(`${env.GITHUB_API}/repos/${env.REPO}`, {
    headers: { Authorization: authorization, Accept: 'application/vnd.github+json', 'User-Agent': 'kanaky-demandes' },
  })
  const repo = res.ok ? await res.json() : null
  if (!repo?.permissions?.push) throw new HttpError(403, 'Accès réservé à l’administration')
}

async function readJson(request) {
  if (Number(request.headers.get('Content-Length')) > MAX_BODY) throw new HttpError(413, 'Demande trop longue')
  const text = await request.text()
  if (text.length > MAX_BODY) throw new HttpError(413, 'Demande trop longue')
  try {
    return JSON.parse(text)
  } catch {
    throw new HttpError(400, 'Demande illisible')
  }
}

async function create(request, env) {
  if (!originAllowed(request.headers.get('Origin'), env)) throw new HttpError(403, 'Accès refusé')
  if (!env.IP_SALT) throw new HttpError(503, 'Service non configuré')
  const body = await readJson(request)
  if (body?.website) return { ok: true } // champ invisible, rempli seulement par les robots
  let proposal
  try {
    proposal = cleanProposal(body)
  } catch (e) {
    throw new HttpError(422, e.message)
  }

  // Identifiant choisi par le site : une demande renvoyée après une coupure n'est pas enregistrée deux fois.
  const id = UUID_RE.test(body.id) ? body.id : crypto.randomUUID()
  if (await env.DB.prepare('SELECT 1 AS n FROM demandes WHERE id = ?').bind(id).first('n')) return { ok: true }

  const now = Date.now()
  const iso = (t) => new Date(t).toISOString()
  const ip = await hashIp(request, env)
  await env.DB.prepare('UPDATE demandes SET ip_hash = NULL WHERE created_at < ?').bind(iso(now - 24 * HOUR)).run()
  const recent = await env.DB.prepare('SELECT count(*) AS n FROM demandes WHERE ip_hash = ? AND created_at > ?').bind(ip, iso(now - HOUR)).first('n')
  if (recent >= MAX_PER_HOUR) throw new HttpError(429, 'Trop de demandes envoyées : réessayez dans une heure.')
  const pending = await env.DB.prepare("SELECT count(*) AS n FROM demandes WHERE status = 'en_attente'").first('n')
  if (pending >= MAX_PENDING) throw new HttpError(503, 'Trop de demandes en attente : réessayez plus tard.')

  await env.DB.prepare('INSERT OR IGNORE INTO demandes (id, created_at, type, target_name, payload, ip_hash) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(id, iso(now), proposal.type, proposal.targetName, JSON.stringify(proposal), ip)
    .run()
  return { ok: true }
}

async function list(env) {
  const { results } = await env.DB.prepare('SELECT id, created_at, status, payload FROM demandes ORDER BY created_at DESC').all()
  return results.map((r) => ({ id: r.id, createdAt: r.created_at, status: r.status, ...JSON.parse(r.payload) }))
}

async function setStatus(id, request, env) {
  const { status } = await readJson(request)
  if (status !== 'en_attente' && status !== 'publiee') throw new HttpError(422, 'Statut inconnu')
  const { meta } = await env.DB.prepare('UPDATE demandes SET status = ? WHERE id = ?').bind(status, id).run()
  if (!meta.changes) throw new HttpError(404, 'Demande introuvable')
  return { ok: true }
}

async function remove(id, env) {
  const { meta } = await env.DB.prepare('DELETE FROM demandes WHERE id = ?').bind(id).run()
  if (!meta.changes) throw new HttpError(404, 'Demande introuvable')
  return { ok: true }
}

async function route(request, env) {
  const [, resource, id] = new URL(request.url).pathname.split('/')
  if (resource !== 'demandes') throw new HttpError(404, 'Adresse inconnue')
  if (request.method === 'POST' && !id) return create(request, env)
  await requireAdmin(request, env)
  if (request.method === 'GET' && !id) return list(env)
  if (request.method === 'PATCH' && id) return setStatus(id, request, env)
  if (request.method === 'DELETE' && id) return remove(id, env)
  throw new HttpError(404, 'Adresse inconnue')
}

export default {
  async fetch(request, env) {
    const headers = { ...corsHeaders(request, env), 'Cache-Control': 'no-store' }
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers })
    try {
      return Response.json(await route(request, env), { headers })
    } catch (e) {
      if (!(e instanceof HttpError)) console.error(e)
      const message = e instanceof HttpError ? e.message : 'Erreur du service'
      return Response.json({ error: message }, { status: e.status || 500, headers })
    }
  },
}
