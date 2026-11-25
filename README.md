# Nouvelle-Calédonie · Une histoire en carte

Site interactif (Vue 3 + Leaflet) qui retrace l'histoire de la Nouvelle-Calédonie, de la culture Lapita à aujourd'hui.

- **Carte** (plein écran) : fond épuré (Esri Light Gray Canvas) dont les terres sont recolorées en vert ; la mer garde sa couleur.
- **Frise chronologique** en bas, en carrousel d'années (en grand) : seules les années qui comptent au moins un événement y figurent. On la fait défiler à la souris (molette, glisser), au doigt ou avec les flèches ← → du clavier (Début/Fin pour les extrémités).
- **Synchronisation** : une seule année est sélectionnée à la fois, centrée et mise en avant ; la carte n'affiche que ses événements, avec un fondu enchaîné au changement d'année.
- **Fiche détaillée** au clic sur un point : image (avec crédit), titre, date, lieu, description, liens vidéo, sources. Elle se ferme en cliquant à côté ou avec Échap ; ← → passent à l'événement précédent/suivant. Lien partageable : `#evenement=<id>`.
- Les événements qui se sont déroulés hors de l'archipel (Paris, Bougival…) sont listés dans un encart sur la carte.

## Lancer le projet

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # vérifie les données puis produit le site statique dans dist/
npm run preview    # prévisualise dist/
```

Le dossier `dist/` peut être déposé sur n'importe quel hébergement statique (GitHub Pages, Netlify, OVH…).

## Structure

```
public/data/events.json     contenu (événements, catégories, périodes)
public/data/tribus.json     tribus affichées sur la carte
public/data/communes.json   communes (position, histoire, image)
public/data/aires.json      contours des aires coutumières (GeoJSON)
public/images/              images du site (cases, pirogue)
public/images/evenements/   images des fiches d’événements, affichées via leur lien GitHub (raw.githubusercontent.com, branche main)
scripts/check-data.mjs      validation du contenu
scripts/import-tribus.mjs   import de la liste officielle des tribus (DITTT)
scripts/import-communes.mjs import des communes et de leur histoire (Wikipédia)
src/App.vue                 chargement des données, filtres, sélection
src/components/MapView.vue  carte Leaflet et marqueurs
src/components/TimelineBar.vue  frise chronologique
src/components/EventModal.vue   fiche d'un événement
src/components/TribuPanel.vue   panneau d'une tribu
src/components/CommunePanel.vue panneau d'une commune
src/components/SearchBox.vue    moteur de recherche (tribus / communes)
src/components/AirePanel.vue    panneau d'une aire coutumière
src/utils/icons.js          logos des catégories d'événements
src/utils/dates.js          dates (format français)
```

## Crédits

Fond de carte © Esri, HERE, Garmin, contributeurs OpenStreetMap ; pour un site très fréquenté, vérifier les conditions d'Esri ou passer à un fournisseur dédié (MapTiler, Stadia Maps…) dans `src/components/MapView.vue`. Images : liens vers Wikimedia Commons, CNRS Images et ce dépôt GitHub (crédit et source indiqués sous l’image quand ils sont connus). Vidéos : archives de l'INA. Les textes sont des résumés à visée pédagogique : à relire et enrichir avec des sources de référence (Musée de Nouvelle-Calédonie, ADCK – centre culturel Tjibaou, Archives de la Nouvelle-Calédonie, travaux universitaires).
