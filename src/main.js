import { createApp } from 'vue'
import 'leaflet/dist/leaflet.css'
import './styles.css'
import App from './App.vue'
import { startQueue } from './utils/demandes'

// Copie hors ligne du site, seulement sur le site publié
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register(import.meta.env.BASE_URL + 'sw.js').catch(() => {}))
}
startQueue()

createApp(App).mount('#app')
