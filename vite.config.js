import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// base './' : le site fonctionne dans n'importe quel sous-dossier (GitHub Pages, Netlify, serveur statique…)
export default defineConfig({
  base: './',
  plugins: [vue()],
})
