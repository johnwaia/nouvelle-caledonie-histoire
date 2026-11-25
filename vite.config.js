import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import kanakyDatabase from './database/vite-plugin.mjs'

// Page d'administration publiée : elle ne peut charger que les scripts du site et n'appeler que GitHub et le service des demandes,
// pour que le jeton saisi ne puisse pas partir ailleurs.
const adminPolicy = (demandesUrl) => [
  "default-src 'none'",
  "script-src 'self' 'wasm-unsafe-eval'",
  "style-src 'self'",
  `connect-src 'self' https://api.github.com ${demandesUrl ? new URL(demandesUrl).origin : ''}`.trim(),
  "img-src 'self' https: blob: data:",
  "base-uri 'none'",
  "form-action 'none'",
].join('; ')
const adminCsp = (demandesUrl) => ({
  name: 'admin-csp',
  apply: 'build',
  transformIndexHtml: (html, { path }) =>
    path === '/admin.html'
      ? [{ tag: 'meta', attrs: { 'http-equiv': 'Content-Security-Policy', content: adminPolicy(demandesUrl) }, injectTo: 'head-prepend' }]
      : html,
})

// L'administration en ligne modifie le dépôt et la branche qui publient le site (variables de GitHub Actions) :
// un site de test ne modifie donc que son propre dépôt.
const define = {
  __REPO__: JSON.stringify(process.env.GITHUB_REPOSITORY || 'johnwaia/nouvelle-caledonie-histoire'),
  __BRANCH__: JSON.stringify(process.env.GITHUB_REF_NAME || 'main'),
}

// base './' : le site fonctionne dans n'importe quel sous-dossier (GitHub Pages, Netlify, serveur statique…)
export default defineConfig(({ mode }) => ({
  base: './',
  define,
  plugins: [vue(), kanakyDatabase(), adminCsp(loadEnv(mode, process.cwd()).VITE_DEMANDES_URL)],
  build: { rollupOptions: { input: ['index.html', 'admin.html'] } },
}))
