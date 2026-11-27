// Publie la base avec le site : data/kanaky.sqlite (sans les images) et chaque image en fichier séparé,
// pour que le navigateur ne télécharge que celles qu'il affiche.
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { DB_FILE, openDb, publicDatabase } from './db.mjs'

// Service worker (src/sw.js), complété par la liste des fichiers à garder hors ligne.
function serviceWorker(bundle, images) {
  const scripts = Object.keys(bundle).filter((f) => f.startsWith('assets/') && !f.startsWith('assets/admin-'))
  const logos = images.filter((id) => id.startsWith('images/logos/'))
  const files = [...scripts, ...logos, 'images/case_kanak_icone.png', 'images/case_kanak_tribu.png']
  const source = readFileSync(new URL('../src/sw.js', import.meta.url), 'utf8')
  const version = createHash('sha256').update(source + files.toSorted((a, b) => a.localeCompare(b)).join()).digest('hex').slice(0, 12)
  return source.replace('__VERSION__', version).replace("['__FILES__']", () => JSON.stringify(files.map(encodeURI)))
}

const unix = (p) => p.replaceAll('\\', '/')

export default function kanakyDatabase() {
  return {
    name: 'kanaky-database',

    // Serveur de développement : lecture directe dans la base, page rechargée si elle change.
    configureServer(server) {
      server.watcher.add(DB_FILE)
      server.watcher.on('change', (f) => {
        if (unix(f) === unix(DB_FILE)) server.ws.send({ type: 'full-reload' })
      })
      server.middlewares.use((req, res, next) => {
        const path = new URL(req.url, 'http://localhost').pathname.slice(1)
        if (path === 'data/kanaky.sqlite') {
          res.setHeader('Cache-Control', 'no-cache')
          res.end(publicDatabase())
          return
        }
        if (!path.startsWith('images/')) return next()
        const db = openDb(DB_FILE, { readOnly: true })
        const row = db.prepare('SELECT mime, data FROM image_data WHERE image_id = ?').get(decodeURIComponent(path))
        db.close()
        if (!row) return next()
        res.setHeader('Cache-Control', 'no-cache')
        res.setHeader('Content-Type', row.mime)
        res.end(Buffer.from(row.data))
      })
    },

    // En dernier : la liste des fichiers du site est alors complète.
    generateBundle: {
      order: 'post',
      handler(_, bundle) {
        // Commit publié : l'administration sait ainsi quand le site est à jour.
        const version = JSON.stringify({ commit: process.env.GITHUB_SHA || null })
        this.emitFile({ type: 'asset', fileName: 'data/version.json', source: version })
        this.emitFile({ type: 'asset', fileName: 'data/kanaky.sqlite', source: publicDatabase() })
        const db = openDb(DB_FILE, { readOnly: true })
        const images = db.prepare('SELECT image_id, data FROM image_data').all()
        for (const { image_id, data } of images) {
          this.emitFile({ type: 'asset', fileName: image_id, source: data })
        }
        db.close()
        this.emitFile({ type: 'asset', fileName: 'sw.js', source: serviceWorker(bundle, images.map((i) => i.image_id)) })
      },
    },
  }
}
