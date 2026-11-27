# Sécurité

Ce que le site protège, et comment.

## Site public

- **Politique de sécurité du contenu** (CSP, ajoutée à la publication par `vite.config.js`) :
  - seuls les scripts du site s'exécutent ;
  - les données ne partent que vers le site lui-même et vers le service des demandes ;
  - les images peuvent venir d'autres sites (Wikimedia, fond de carte).
- **Textes** : tout ce qui vient de la base est affiché comme du texte, jamais comme du code. Les bulles de la carte, construites en HTML, échappent leur contenu (`esc` dans `MapView.vue`). Les adresses d'images placées dans les styles sont encodées (`cssUrl`).
- **Liens** : les sources et vidéos doivent commencer par `http://` ou `https://`. Les liens externes s'ouvrent avec `rel="noopener noreferrer"`.

## Images SVG

Un SVG peut contenir du code, et il est publié sur la même adresse que l'administration. À l'envoi, `src/db/write.js` refuse donc tout SVG qui contient :
- un script ;
- un gestionnaire d'événement (`onload=`…) ;
- un contenu intégré (`foreignObject`, `iframe`…) ;
- un lien externe.

`npm run check-data` vérifie aussi tous les SVG déjà présents dans la base.

## Administration en ligne (`admin.html`)

- **Jeton GitHub** :
  - il est gardé en mémoire seulement, jamais enregistré ;
  - il n'est envoyé qu'à GitHub et au service des demandes ;
  - une CSP stricte empêche de l'envoyer ailleurs.
- **Jeton recommandé** : « fine-grained », limité au dépôt, avec la seule permission « Contents : Read and write » et une date d'expiration.
- **Cadres** : la page refuse de s'afficher dans le cadre d'une autre page, ce qui empêche qu'un site piégé la recouvre pour faire saisir le jeton.
- **Publication** : refusée si la base a changé entre-temps sur GitHub, plutôt que d'écraser ces changements.

## Administration locale (`npm run admin`)

- Elle n'écoute que sur l'ordinateur (127.0.0.1).
- Elle refuse les requêtes d'un autre site : adresse et origine sont vérifiées, ce qui bloque le « DNS rebinding » et les requêtes forgées.
- Les SVG servis par l'administration locale ne peuvent pas exécuter de script.
- `gh` est lancé par son chemin complet, sans passer par le `PATH`.

## Service des demandes (`worker/`)

- **Envoi** : n'importe quel visiteur peut envoyer une demande, mais seulement depuis le site autorisé (`ALLOWED_ORIGINS`).
- **Limites** :
  - 5 envois par heure et par visiteur ;
  - 1 000 demandes en attente au maximum ;
  - 60 Ko par demande, taille vérifiée avant lecture.
- **Validation** : les demandes passent par les mêmes règles que le site (`src/db/proposals.js`). Un champ piège arrête les robots.
- **Lecture et traitement** : réservés aux personnes qui ont le droit d'écrire dans le dépôt GitHub, ce que GitHub vérifie à chaque appel.
- **Vie privée** : l'adresse IP n'est gardée que sous forme d'empreinte, effacée après 24 heures.

Après une modification de `worker/src/index.mjs` ou de `src/db/proposals.js`, il faut redéployer le service :

```bash
npx wrangler@4 deploy --config worker/wrangler.toml
```

## Publication

- Le workflow GitHub Actions est en lecture seule, sauf l'étape de déploiement.
- Les dépendances sont installées sans exécuter leurs scripts (`npm ci --ignore-scripts`).
- `npm audit` ne signale aucune vulnérabilité (novembre 2026).
