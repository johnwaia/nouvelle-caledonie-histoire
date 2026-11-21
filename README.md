# Nouvelle-Calédonie · Une histoire en carte

Site interactif (Vue 3 + Leaflet) qui retrace l'histoire de la Nouvelle-Calédonie, de la culture Lapita à aujourd'hui.

- **Carte** (plein écran) : fond épuré (Esri Light Gray Canvas) dont les terres sont recolorées en vert ; la mer garde sa couleur.
- **Frise chronologique** en bas, en carrousel d'années (en grand) : seules les années qui comptent au moins un événement y figurent. On la fait défiler à la souris (molette, glisser), au doigt ou avec les flèches ← → du clavier (Début/Fin pour les extrémités).
- **Synchronisation** : une seule année est sélectionnée à la fois, centrée et mise en avant ; la carte n'affiche que ses événements, avec un fondu enchaîné au changement d'année. L'option « Afficher les années précédentes » laisse les événements antérieurs en transparence.
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

## Ajouter ou mettre à jour un événement

Tout le contenu se trouve dans **`public/data/events.json`**. Il est lu au chargement de la page : en production, il suffit de remplacer ce fichier sur le serveur (`dist/data/events.json`), **sans recompiler le site**.

Ajoutez un objet dans la liste `events` (l'ordre n'a pas d'importance, le tri se fait par date) :

```json
{
  "id": "exemple-2026",
  "date": "2026-03-15",
  "title": "Titre court de l'événement",
  "place": "Koné",
  "coords": [-21.06, 164.86],
  "category": "politique",
  "description": "Un ou deux paragraphes.\n\nUne ligne vide (\\n\\n) crée un nouveau paragraphe.",
  "image": { "url": "https://…/photo.jpg", "credit": "Auteur — licence", "alt": "Description de l'image", "source": "https://commons.wikimedia.org/wiki/File:…" },
  "videos": [
    { "label": "Titre — chaîne, date (INA)", "url": "https://www.ina.fr/…" }
  ],
  "sources": [
    { "label": "Nom de la source", "url": "https://…" }
  ]
}
```

| Champ | Obligatoire | Détail |
|---|---|---|
| `id` | oui | identifiant unique, minuscules et tirets (sert aux liens partagés) |
| `date` | oui | `AAAA`, `AAAA-MM` ou `AAAA-MM-JJ` ; avant notre ère : nombre négatif (`"-1100"`) |
| `endDate` | non | pour un événement qui dure (affiché comme une barre sur la frise) |
| `approx` | non | `true` → affiche « vers … » |
| `dateLabel` | non | texte libre qui remplace la date affichée (« Années 1840 ») |
| `place` | oui | nom du lieu affiché |
| `coords` | oui | `[latitude, longitude]` (latitude négative, ex. `[-22.27, 166.45]`), ou `null` si hors de l'archipel |
| `category` | oui | une clé de `categories` (voir en haut du fichier) |
| `description` | oui | texte de la fiche |
| `image` | non | `url`, `credit`, `alt`, `source` (page de l'image, liée depuis le crédit) — privilégier Wikimedia Commons ou des images libres de droits |
| `videos` | non | liste de `{ "label", "url" }` (archives INA, etc.), affichée dans la fiche |
| `sources` | conseillé | liste de `{ "label", "url" }` |

Pour trouver des coordonnées : clic droit sur un lieu dans OpenStreetMap ou Google Maps → les copier dans l'ordre latitude, longitude.

Avant de publier, lancez :

```bash
npm run check-data
```

Le script signale les erreurs (date mal écrite, id en double, catégorie inconnue, coordonnées inversées, source manquante…).

### Tribus

Les **345 tribus** sont dans **`public/data/tribus.json`** : les 344 tribus de la liste officielle (Gouvernement de la Nouvelle-Calédonie / DITTT, couche « Localités et zones bâties ») + Hnathalo. Elles s'affichent toutes ensemble avec le bouton **« Afficher les tribus »** de l'en-tête (indépendamment de l'année choisie) ; chacune est représentée par une case (`public/case_kanak_icone.png`). Un clic ouvre un panneau (fermeture : croix, clic à l'extérieur ou Échap) ; lien partageable `#tribu=<id>`.

Pour mettre à jour la liste depuis la source officielle (les fiches rédigées sont conservées) :

```bash
node scripts/import-tribus.mjs
```

Fiche détaillée (champs facultatifs, à ajouter à une tribu existante) :

```json
{
  "id": "tiendanite",
  "nom": "Tiendanite",
  "nomLocal": "Tândanit",
  "commune": "Hienghène",
  "ile": "Grande Terre (côte est)",
  "coords": [-20.75818, 164.89887],
  "aire": "Hoot ma Whaap",
  "origines": "Texte court.",
  "evenements": [{ "date": "5 décembre 1984", "texte": "…" }],
  "sources": [{ "label": "…", "url": "https://…" }]
}
```

Les images d'origine (avant détourage) sont conservées dans `assets-sources/`.

### Catégories et périodes

- `categories` : couleur des points sur la carte.
- `periods` : découpage en grandes périodes (non affiché actuellement). `"to": null` = jusqu'à aujourd'hui.

Un événement est rangé dans l'année de sa `date` de début (un événement avec `endDate` n'apparaît que dans son année de départ).

### Brancher d'autres sources (actualités, CMS…)

Le site peut fusionner plusieurs fichiers JSON au même format. Créez un fichier `.env.local` :

```
VITE_EVENTS_URLS=data/events.json,https://mon-serveur.nc/actualites.json
```

Un événement portant le même `id` dans un fichier suivant remplace le précédent. On peut ainsi tenir un fichier d'actualités séparé, alimenté par un CMS headless (Strapi, Directus, Decap CMS…) ou un export de tableur, sans toucher à la chronologie historique. (Le serveur distant doit autoriser les requêtes CORS.)

## Structure

```
public/data/events.json     contenu (événements, catégories, périodes)
public/data/tribus.json     tribus affichées sur la carte
scripts/check-data.mjs      validation du contenu
scripts/import-tribus.mjs   import de la liste officielle des tribus (DITTT)
src/App.vue                 chargement des données, filtres, sélection
src/components/MapView.vue  carte Leaflet et marqueurs
src/components/TimelineBar.vue  frise chronologique
src/components/EventModal.vue   fiche d'un événement
src/components/TribuPanel.vue   panneau d'une tribu
src/utils/dates.js          dates (format français)
```

## Crédits

Fond de carte © Esri, HERE, Garmin, contributeurs OpenStreetMap ; pour un site très fréquenté, vérifier les conditions d'Esri ou passer à un fournisseur dédié (MapTiler, Stadia Maps…) dans `src/components/MapView.vue`. Images : Wikimedia Commons (auteur et licence indiqués sous chaque image). Vidéos : archives de l'INA. Les textes sont des résumés à visée pédagogique : à relire et enrichir avec des sources de référence (Musée de Nouvelle-Calédonie, ADCK – centre culturel Tjibaou, Archives de la Nouvelle-Calédonie, travaux universitaires).
