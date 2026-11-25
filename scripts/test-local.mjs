/*
 * Essai complet en local : npm run test-local
 * Lance le service des demandes, le site et l'administration, sur une copie de la base (dossier .test-local).
 * Rien n'est publié et la vraie base n'est pas modifiée. « npm run test-local -- --reset » repart de zéro.
 */
import { spawn, spawnSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, rmSync } from 'node:fs'
import { createServer } from 'node:net'
import { resolve } from 'node:path'

const DIR = resolve('.test-local')
const DB = resolve(DIR, 'kanaky.sqlite')
// Ports différents de « npm run dev » et « npm run admin »
const PORTS = { service: 8790, site: 5190, admin: 5191 }
const SERVICE = `http://127.0.0.1:${PORTS.service}`
const SITE = `http://localhost:${PORTS.site}`
const WRANGLER = ['npx', '--yes', 'wrangler@4']
const D1 = ['--config', 'worker/wrangler.toml', '--persist-to', '.test-local/demandes']

const isFree = (port) =>
  new Promise((done) => {
    const probe = createServer()
    probe.once('error', () => done(false))
    probe.listen(port, '127.0.0.1', () => probe.close(() => done(true)))
  })
const free = await Promise.all(Object.values(PORTS).map(isFree))
if (free.includes(false)) {
  console.error('Un essai est déjà en cours (ports 8790, 5190 ou 5191 occupés) : fermez-le d’abord.')
  process.exit(1)
}

if (process.argv.includes('--reset')) rmSync(DIR, { recursive: true, force: true })
mkdirSync(DIR, { recursive: true })
if (!existsSync(DB)) copyFileSync('database/kanaky.sqlite', DB)

const env = { ...process.env, KANAKY_DB: DB, VITE_DEMANDES_URL: SERVICE, PORT: String(PORTS.admin), CI: '1' }
const options = { env, shell: true, stdio: 'inherit' }

console.log('Préparation de la base des demandes…')
const setup = [...WRANGLER, 'd1', 'execute', 'kanaky-demandes', '--local', ...D1, '--file', 'worker/schema.sql']
const prepared = spawnSync(setup.join(' '), { ...options, stdio: ['ignore', 'ignore', 'inherit'] })
if (prepared.status) process.exit(prepared.status)

const commands = [
  [...WRANGLER, 'dev', ...D1, '--port', PORTS.service, '--var', 'IP_SALT:test-local', '--var', `ALLOWED_ORIGINS:${SITE}`, '--show-interactive-dev-session=false'],
  ['npx', 'vite', '--port', PORTS.site, '--strictPort'],
  ['npm', 'run', 'admin'],
]
const children = commands.map((c) => spawn(c.join(' '), { ...options, stdio: ['ignore', 'inherit', 'inherit'] }))
for (const child of children) child.on('exit', (code) => code && console.error('Un des programmes s’est arrêté : voir le message ci-dessus.'))

setTimeout(() => {
  console.log(`
────────────────────────────────────────────────
 Site            ${SITE}
 Administration  http://127.0.0.1:${PORTS.admin}
 Copie de la base : .test-local (Ctrl+C pour arrêter)
────────────────────────────────────────────────`)
}, 9000)
