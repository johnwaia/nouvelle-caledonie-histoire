# KANAKY · Une histoire en carte

Site interactif (Vue 3 + Leaflet) qui retrace l'histoire de la Nouvelle-Calédonie, de la culture Lapita à aujourd'hui : 75 événements, 347 tribus et 33 communes.

## Fonctionnalités

- **Carte** (plein écran) : fond épuré (Esri Light Gray Canvas) dont les terres sont recolorées en vert. Les points trop proches s'écartent en restant, autant que possible, sur la terre ferme.
- **Frise chronologique** en bas : seules les années qui comptent au moins un événement y figurent. On la fait défiler à la souris, au doigt ou avec ← → (Début/Fin pour les extrémités).
- **Une année à la fois** : la carte n'affiche que les événements de l'année choisie, avec un fondu au changement d'année. Les événements hors de l'archipel (Paris, Bougival…) sont listés dans un encart.
- **Logos sur la carte** : drapeaux, casse-tête, usine… ou, à défaut, l'icône de la catégorie. Les référendums ont une urne, barrée d'une croix rouge s'ils ont été boycottés (1987 et 2021).
- **Fiche d'événement** au clic : image, date, lieu, description, vidéos, sources. Échap ou un clic à côté la ferme ; ← → passent à l'événement précédent ou suivant. Lien partageable : `#evenement=<id>`.
- **Tribus, communes, aires coutumières et provinces** : boutons de l'en-tête et fiche au clic. La fiche d'une commune liste ses tribus. Aires et provinces ne s'affichent pas en même temps. Liens partageables : `#tribu=<id>`, `#commune=<id>`.
- **Recherche** d'une tribu ou d'une commune : la carte n'affiche plus que le résultat choisi.

## Lancer le projet

Node.js 20.19 ou plus récent (22.12 au minimum pour la version 22).

```bash
npm install
npm run dev         # http://localhost:5173
npm run check-data  # vérifie les données
npm run build       # vérifie les données puis produit le site statique dans dist/
npm run preview     # prévisualise dist/
```

## Publication

Chaque push sur `main` publie le site sur GitHub Pages (`.github/workflows/deploy.yml`). À activer une fois : Settings → Pages → Source « GitHub Actions ». Le dossier `dist/` peut aussi être déposé sur n'importe quel hébergement statique.

## Structure

```
public/data/events.json     événements, catégories, périodes
public/data/tribus.json     tribus
public/data/communes.json   communes (position, histoire, image)
public/data/aires.json      contours des aires coutumières (GeoJSON)
public/data/provinces.json  contours des provinces (GeoJSON), aussi utilisés pour placer les points sur terre
public/images/              icônes du site
public/images/logos/        logos des événements sur la carte
public/images/evenements/   images des fiches d'événements (voir « Images »)
assets-sources/             fichiers d'origine des logos
scripts/check-data.mjs      validation des données
scripts/import-tribus.mjs   import de la liste officielle des tribus (DITTT)
scripts/import-communes.mjs import des communes et de leur histoire (Wikipédia)
src/App.vue                 chargement des données, sélection, navigation
src/components/MapView.vue       carte Leaflet et marqueurs
src/components/TimelineBar.vue   frise chronologique
src/components/SearchBox.vue     recherche (tribus / communes)
src/components/EventModal.vue    fiche d'un événement
src/components/TribuPanel.vue    fiche d'une tribu
src/components/CommunePanel.vue  fiche d'une commune
src/components/AirePanel.vue     fiche d'une aire coutumière
src/components/ProvincePanel.vue fiche d'une province
src/components/PhotoFigure.vue   image d'une fiche, avec son crédit
src/components/CategoryIcon.vue  icône d'une catégorie
src/utils/icons.js          icônes des catégories
src/utils/dates.js          dates (format français)
```

## Ajouter un événement

Dans `public/data/events.json` :

```json
{
  "id": "mon-evenement-1984",
  "logo": "images/logos/drapeau_kanaky.svg",
  "date": "1984-12-01",
  "title": "Titre",
  "place": "Nouméa",
  "coords": [-22.276, 166.452],
  "category": "politique",
  "description": "Texte.\n\nNouveau paragraphe.",
  "image": { "url": "https://…", "alt": "Description", "credit": "Auteur — licence", "source": "https://…" },
  "videos": [{ "label": "Titre de la vidéo", "url": "https://…" }],
  "sources": [{ "label": "Nom de la source", "url": "https://…" }]
}
```

- **Obligatoires** : `id` (a-z, 0-9, tirets), `title`, `date`, `place`, `category`, `description`.
- `date` et `endDate` (facultatif) : `AAAA`, `AAAA-MM` ou `AAAA-MM-JJ` ; année négative avant notre ère.
- `approx` : date approximative ; `dateLabel` : texte affiché à la place de la date.
- `coords` : `[latitude, longitude]`, ou `null` hors de l'archipel.
- `logo` : `images/logos/urne.svg` pour un référendum, `images/logos/urne_boycott.svg` s'il a été boycotté.
- `auSud: true` : place le point plus bas que les autres points de l'année (ex. les drapeaux de 1984).

## Images

- Les images d'événements sont affichées par un **lien**, jamais par un chemin local. Celles du dépôt utilisent : `https://raw.githubusercontent.com/johnwaia/nouvelle-caledonie-histoire/main/public/images/evenements/<fichier>`.
- Ces liens pointent vers la branche `main` : une nouvelle image n'apparaît qu'une fois poussée. Supprimer ou renommer un fichier, ou rendre le dépôt privé, casse l'image.
- Les fiches des tribus n'ont pas d'image.

## Mettre à jour les tribus et les communes

```bash
node scripts/import-tribus.mjs    # conserve les fiches rédigées et les ajouts (« ajoutManuel »)
node scripts/import-communes.mjs
```

Attention : l'import des communes recharge les textes depuis Wikipédia. Les retouches faites à la main dans `resume` et `histoire` sont à vérifier ensuite avec `git diff`.

## Crédits

Fond de carte © Esri, HERE, Garmin, contributeurs OpenStreetMap ; pour un site très fréquenté, vérifier les conditions d'Esri ou passer à un fournisseur dédié (MapTiler, Stadia Maps…) dans `src/components/MapView.vue`. Tribus : Gouvernement de la Nouvelle-Calédonie / DITTT. Histoire des communes : Wikipédia (CC BY-SA 4.0). Images : Wikimedia Commons, CNRS Images et ce dépôt ; le crédit est affiché sous l'image quand il est connu. Les images de `public/images/evenements/` n'ont pas encore de crédit : auteurs et droits restent à vérifier. Vidéos : archives de l'INA.

Les textes sont des résumés à visée pédagogique : à relire et enrichir avec des sources de référence (Musée de Nouvelle-Calédonie, ADCK – centre culturel Tjibaou, Archives de la Nouvelle-Calédonie, travaux universitaires).
