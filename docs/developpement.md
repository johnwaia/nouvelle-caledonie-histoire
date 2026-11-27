# Développement

Le site est une application **Vue 3** construite avec **Vite**. La carte utilise **Leaflet**, et les données sont lues dans une base **SQLite**.

## Lancer le projet

Node.js 22.13 ou plus récent (SQLite intégré).

```bash
npm install
npm run dev         # site : http://localhost:5173
npm run admin       # administration locale : http://127.0.0.1:5180
npm run check-data  # vérifie la base
npm run build       # vérifie la base puis produit le site statique dans dist/
npm run preview     # prévisualise dist/
npm run test-local  # service des demandes + site + administration sur une copie de la base
```

`npm run test-local` lance le service des demandes, le site (http://localhost:5190) et l'administration (http://127.0.0.1:5191) ; `npm run test-local -- --reset` repart de zéro. Il faut être connecté à GitHub (`gh auth login`) pour lire les demandes.

## Structure

```
database/kanaky.sqlite      la base de données
database/schema.sql         description des tables
database/db.mjs             lecture et écriture depuis Node
database/vite-plugin.mjs    publication de la base, des images et de la copie hors ligne
admin.html, admin/          administration (ui.js : interface ; online.js : version en ligne ;
                            server.mjs : version locale ; place.js : champ « Lieu » ;
                            demandes.js : onglet des demandes)
worker/                     service des demandes (Cloudflare Worker + D1)
scripts/                    vérification de la base, imports des tribus et des communes
public/images/              icônes du site
assets-sources/             fichiers d'origine de certains logos
docs/                       cette documentation
src/App.vue                 chargement des données, année et mois, sélection, navigation, clavier
src/sw.js                   copie hors ligne
src/db/                     lecture (read.js), écriture (write.js), règles (checks.js, proposals.js),
                            actions de l'administration (api.js), ouverture dans le navigateur (client.js)
src/components/
  MapView.vue               carte, points, placement, groupes, tribus, communes, aires, provinces
  TimelineBar.vue           frise chronologique
  SearchBox.vue             recherche
  EventModal.vue            fiche d'un événement et sa galerie
  TribuPanel.vue, CommunePanel.vue, AirePanel.vue, ProvincePanel.vue   fiches des lieux
  ProposeButton.vue         boutons Ajouter / Modifier d'une fiche
  ProposeEventButton.vue    bouton « Ajouter un événement »
  QueueNotice.vue           demandes en attente d'envoi
  PhotoFigure.vue           image d'une fiche, avec son crédit
  CategoryIcon.vue          icône d'une catégorie
src/utils/                  icônes, dates en français, envoi des demandes, stockage dans le navigateur
src/styles.css              styles du site
```

## Points techniques

### Placement des points

`layoutPins` (`MapView.vue`) essaie, pour chaque point, des positions en spirale autour de son lieu. Il garde la première qui ne recouvre aucun point déjà posé, reste sur la terre ferme et sur la même île, et respecte l'ordre nord-sud. Les points sont posés du nord au sud.

Pour savoir si une position est sur la terre, `landAt` cherche l'île sous le point dans les contours des provinces (plus de 2 000 îles et îlots). Deux optimisations rendent ce test quasi instantané :

- chaque contour est préparé une seule fois : coordonnées en tableaux typés, et côtés rangés par **bandes horizontales**. Un test ne parcourt que les quelques côtés à la hauteur du point, au lieu des milliers de côtés de la Grande Terre ;
- les contours sont lus **hors de la réactivité de Vue** (`toRaw`). Lire chaque coordonnée à travers les proxys réactifs était très lent.

Avant ces optimisations, chaque zoom bloquait la page près de 2 secondes sur un téléphone.

### Tribus

Les 347 tribus sont des marqueurs Leaflet légers :

- l'ombre de la case est **dessinée dans l'image** (`public/images/case_kanak_tribu.png`). Un filtre CSS sur chaque case ralentissait beaucoup la carte sur mobile ;
- l'animation d'apparition n'est jouée que si peu de cases apparaissent à la fois (30 au maximum, `ANIMATE_UP_TO`) ;
- les bulles d'information ne sont créées qu'au survol.

### Données dans le navigateur

`src/db/client.js` télécharge `data/kanaky.sqlite` et l'ouvre avec sql.js ; `readAll` (`src/db/read.js`) en tire les objets utilisés par le site. Une base publiée avant l'ajout d'une table (par exemple `event_images`) reste lisible : la table manquante est ignorée.

## Vérifier une modification

1. `npm run check-data` puis `npm run build`.
2. `npm run dev` et vérifier sur ordinateur **et** en vue mobile (largeur ≤ 760 px), notamment les années chargées (1984, 1985) et l'affichage des tribus.
3. Committer, puis pousser sur `main` pour publier.
