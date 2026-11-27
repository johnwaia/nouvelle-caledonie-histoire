# Base de données

Toutes les informations et les images du site sont dans un seul fichier : **`database/kanaky.sqlite`**. Les tables sont décrites dans `database/schema.sql`.

## Comment le site la lit

- À la publication, le navigateur reçoit une **copie sans les images** (`data/kanaky.sqlite`) et la lit avec [sql.js](https://sql.js.org).
- Chaque image stockée dans la base devient un **fichier séparé** (`images/evenements/…`, `images/logos/…`), chargé seulement quand il est affiché.
- Lecture : `src/db/read.js` ; écriture : `src/db/write.js`. Les mêmes fonctions servent au site, à l'administration et aux scripts.

## Tables

| Table | Contenu |
|---|---|
| `events` | événements : titre, date, date de fin, date approximative, texte de date, lieu, coordonnées, catégorie, description, logo, image principale, « placer sous les autres », ordre |
| `event_images` | images supplémentaires d'un événement, dans l'ordre |
| `event_sources` | sources d'un événement |
| `event_videos` | vidéos d'un événement |
| `categories` | catégories (nom, couleur, ordre) |
| `periods` | grandes périodes historiques |
| `images` | toutes les images : identifiant, crédit, page d'origine |
| `image_data` | contenu des images stockées dans la base |
| `tribus`, `tribu_evenements`, `tribu_sources` | tribus, leurs événements marquants et leurs sources |
| `communes`, `commune_sources` | communes et leurs sources |
| `aires`, `provinces` | zones de la carte (contour GeoJSON, couleur, description) |

## Règles pour un événement

- **Obligatoires** : identifiant (a-z, 0-9, tirets), titre, date, lieu, catégorie, description.
- **Date** : `AAAA`, `AAAA-MM` ou `AAAA-MM-JJ` ; année négative avant notre ère. Le mois sert aux boutons de mois (voir [frise-annees-mois.md](frise-annees-mois.md)).
- **Date de fin** (facultative) : pour un événement qui dure.
- **Date approximative** et **texte affiché à la place de la date** (« Années 1960-1970 », « 1958 (ou 1957) ») : facultatifs.
- **Lieu** : texte affiché dans la fiche ; les **coordonnées** placent le point. Sans coordonnées, l'événement est « hors de l'archipel ».
- **Logo** (facultatif) : voir [images-et-logos.md](images-et-logos.md).
- **Placer sous les autres points de l'année** : utilisé pour les drapeaux de 1984 ; sans effet s'il ne reste pas assez de terre en dessous.
- **Sources** recommandées (un avertissement est affiché sinon).

Les événements d'une même date sont départagés par leur ordre d'enregistrement.

## Catégories

| Catégorie | Couleur |
|---|---|
| Peuplement & sociétés kanak | ocre |
| Explorations & missions | bleu |
| Colonisation & bagne | violet |
| Conflits & violences | rouge |
| Politique & institutions | rose |
| Économie & nickel | orange |
| Culture & patrimoine | vert d'eau |
| Environnement | vert |
| Santé | bleu ciel |

Nom et couleur se modifient dans l'onglet « Catégories » de l'administration.

## Vérifier la base

```bash
npm run check-data
```

Affiche les erreurs (qui bloquent la publication) et les avertissements (sans source, image sans crédit…), puis un bilan : nombre d'événements, de tribus, de communes et d'images. `npm run build` lance cette vérification avant de construire le site.

## Mettre à jour les tribus et les communes

```bash
node scripts/import-tribus.mjs    # liste officielle des tribus (DITTT)
node scripts/import-communes.mjs  # communes et leur histoire (Wikipédia)
```

- L'import des tribus **conserve** les fiches rédigées et les tribus ajoutées à la main (case « Conserver cette tribu lors d'un import officiel »).
- L'import des communes **recharge** « Présentation » et « Histoire » depuis Wikipédia. Pour garder un texte retouché, le mettre dans « Histoire manuelle ».

## Précautions

- Git ne sait pas **fusionner** deux versions de la base : faire `git pull` avant de la modifier, et ne pas la modifier sur deux branches ou à deux endroits en même temps.
- Faire une copie du fichier avant une grosse modification.
