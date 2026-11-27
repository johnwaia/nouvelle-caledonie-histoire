# Administration

L'administration permet de modifier toutes les données du site : événements, tribus, communes, aires, provinces, catégories, périodes et images. Elle traite aussi les demandes des visiteurs.

Il en existe deux versions, avec la même interface (`admin/ui.js`) :

| Version | Adresse | Enregistre dans | Publication |
|---|---|---|---|
| **Locale** | `npm run admin`, puis http://127.0.0.1:5180 | `database/kanaky.sqlite` sur l'ordinateur | committer la base, puis pousser sur `main` |
| **En ligne** | `admin.html` du site publié (lien « Administration » dans le bouton **i** de la carte) | une copie de la base dans la page | bouton **Publier** (commit GitHub) |

## Administration en ligne

1. Créer une fois un **jeton GitHub « fine-grained »** limité au dépôt, avec la seule permission « Contents : Read and write » et une date d'expiration. La page de connexion détaille les étapes.
2. Se connecter avec ce jeton. La page indique le dépôt et la branche modifiés.
3. Modifier et enregistrer les fiches.
4. Cliquer sur **Publier** : toutes les modifications partent dans un seul commit sur `main`, et le site est republié en une à deux minutes.

À savoir :

- Tant que « Publier » n'a pas été cliqué, les changements n'existent que dans la page : la fermer les perd.
- Si la base a été modifiée ailleurs entre-temps, la publication est refusée plutôt que d'écraser ce travail.
- Le jeton n'est jamais enregistré. Ne pas le partager ; le révoquer sur GitHub en cas de doute.
- Le déploiement est essayé trois fois ; en cas d'échec, un lien permet de le relancer.

## Administration locale

1. Faire `git pull` avant de commencer.
2. `npm run admin`, puis ouvrir http://127.0.0.1:5180.
3. Vérifier le résultat avec `npm run dev` : la page se recharge à chaque enregistrement.
4. Committer `database/kanaky.sqlite` et pousser sur `main`.

> **Attention** : Git ne sait pas fusionner deux versions de la base. Ne pas publier depuis l'administration en ligne tant que des modifications locales ne sont pas poussées, et inversement. Chaque publication ajoute plusieurs Mo à l'historique : mieux vaut regrouper les modifications.

## Onglets

| Onglet | Contenu |
|---|---|
| **Événements** | titre, dates, catégorie, lieu, description, logo, image principale, **autres images**, sources, vidéos (voir [base-de-donnees.md](base-de-donnees.md)) |
| **Tribus** | nom, nom local, commune, aire, île, coordonnées, origines, événements marquants, sources, « conserver lors d'un import officiel » |
| **Communes** | nom, province, aire, coordonnées, présentation, histoire (Wikipédia), histoire manuelle, page Wikipédia, image, sources |
| **Aires** et **Provinces** | nom, couleur, description (le contour ne se modifie pas ici) |
| **Catégories** | nom et couleur des catégories d'événements |
| **Périodes** | grandes périodes historiques (nom, années, couleur) |
| **Images** | toutes les images de la base : envoi, remplacement, crédit, page d'origine, nombre d'utilisations ; une image inutilisée peut être supprimée |
| **Demande de modifications** | propositions des visiteurs, avec le nombre de demandes en attente |

La liste de chaque onglet peut être filtrée avec le champ « Filtrer… ».

## Le champ « Lieu » d'un événement

On choisit une **commune** ou une **tribu** : le point se place seul sur la carte. « Autre lieu » permet de cliquer sur une carte pour un point précis, ou de ne mettre **aucun point** (événement hors de l'archipel). Code : `admin/place.js`.

## Images d'un événement

- **Image** : l'image principale. On peut choisir une image de la base, coller un lien `https://…` ou envoyer un fichier (8 Mo au maximum). Une image déjà connue reprend son crédit et sa source.
- **Autres images** : une ligne par image supplémentaire (image, description, crédit, page d'origine). Elles s'affichent après l'image principale, en défilement horizontal.

Voir [images-et-logos.md](images-et-logos.md).

## Demandes des visiteurs

L'onglet **« Demande de modifications »** liste les propositions envoyées depuis le site (voir [contributions.md](contributions.md)).

- Chaque demande montre les **différences mot à mot** entre la fiche actuelle et la proposition.
- Un avertissement apparaît si la fiche a changé depuis l'envoi de la demande.
- **Publier** applique la demande à la fiche (ou crée le nouvel événement) ; la demande passe alors au statut « Publiée ».
- **Supprimer** l'efface.

Les demandes sont gardées dans le service Cloudflare, pas dans la base du site. L'administration s'y identifie avec le jeton GitHub (en ligne) ou le compte `gh` (en local).

## Vérifications à l'enregistrement

Chaque fiche est vérifiée avant d'être enregistrée (`src/db/checks.js`) :

- **Erreurs** (enregistrement refusé) : champ obligatoire vide, date invalide, date de fin avant la date de début, lien invalide…
- **Avertissements** (enregistrement accepté) : aucune source, image sans crédit, coordonnées hors de l'archipel…
