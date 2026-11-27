# Hors ligne et publication

## Publication du site

- Chaque **push sur `main`** publie le site sur **GitHub Pages** (`.github/workflows/deploy.yml`). Le déploiement prend une à deux minutes.
- À activer une seule fois : Settings → Pages → Source « GitHub Actions ».
- `npm run build` vérifie la base puis produit le site statique dans `dist/`. Ce dossier peut aussi être déposé sur n'importe quel hébergement statique.
- À la construction, `database/vite-plugin.mjs` publie :
  - `data/kanaky.sqlite` : la base **sans le contenu des images** (bien plus légère) ;
  - chaque image de la base en fichier séparé ;
  - `sw.js` : la copie hors ligne.

## Copie hors ligne

Code : `src/sw.js` (service worker).

Après une première visite, le site s'ouvre **même sans Internet** ou si l'hébergeur est indisponible :

| Contenu | Stratégie |
|---|---|
| Page et base de données | version en ligne d'abord ; copie enregistrée si le réseau ne répond pas |
| Scripts et styles | copie enregistrée d'abord (leur nom change à chaque version) |
| Logos et icônes | enregistrés dès la première visite |
| Images d'événements | enregistrées quand elles ont été vues, rafraîchies en arrière-plan |
| Fond de carte | **non disponible** hors ligne |

Un message signale que le site affiche la version enregistrée ; le bouton « Réessayer » recharge la version en ligne. La copie hors ligne ne fonctionne que sur le site publié (pas avec `npm run dev`).

## Service des demandes (Cloudflare)

Les propositions des visiteurs (voir [contributions.md](contributions.md)) sont reçues par un petit service Cloudflare (`worker/`) et gardées dans sa base D1, **privée et séparée** de la base du site.

| Requête | Qui | Rôle |
|---|---|---|
| `POST /demandes` | visiteur | envoie une demande (5 par heure au maximum) |
| `GET /demandes` | administration | liste les demandes |
| `PATCH /demandes/<id>` | administration | change le statut (publiée) |
| `DELETE /demandes/<id>` | administration | supprime |

L'administration s'identifie avec son jeton GitHub, vérifié par GitHub et jamais conservé. L'adresse du visiteur n'est gardée que sous forme d'empreinte, pour limiter le nombre d'envois.

### Installation, une seule fois (compte Cloudflare gratuit)

```bash
npx wrangler@4 login
npx wrangler@4 d1 create kanaky-demandes        # copier database_id dans worker/wrangler.toml
npx wrangler@4 d1 execute kanaky-demandes --remote --config worker/wrangler.toml --file worker/schema.sql
npx wrangler@4 deploy --config worker/wrangler.toml
npx wrangler@4 secret put IP_SALT --config worker/wrangler.toml   # une longue phrase au hasard
```

Puis mettre l'adresse affichée par `deploy` dans `.env.production` (`VITE_DEMANDES_URL`) et publier le site. **Sans cette adresse, les boutons Ajouter, Modifier et « Ajouter un événement » sont masqués.**

Après une modification de `src/db/proposals.js` (règles des demandes), redéployer le service :

```bash
npx wrangler@4 deploy --config worker/wrangler.toml
```

## Disponibilité

- **Demandes** : brouillon gardé 30 jours dans le navigateur ; si le service est indisponible, la demande est gardée puis renvoyée lors d'une prochaine visite, sans doublon.
- **Publication depuis l'administration** : le déploiement est essayé trois fois ; un lien permet de le relancer s'il échoue.
