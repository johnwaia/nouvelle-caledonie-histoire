# Images et logos

## Où sont les images

Une image est soit :

- **stockée dans la base** (table `image_data`). Son identifiant est le chemin où le site la publie : `images/evenements/x.jpg`, `images/logos/x.png`, `images/communes/x.jpg` ;
- soit un **simple lien** `https://…` (Wikimedia Commons, CNRS…), affiché tel quel.

Formats acceptés : JPEG, PNG, WebP, AVIF, GIF, SVG. 8 Mo au maximum par fichier.

Les fichiers d'origine déposés dans `public/images/` pour être ajoutés ne doivent pas être committés : une fois l'image stockée dans la base, ils peuvent être supprimés. Seules les icônes du site restent dans `public/images/` (`case_kanak.png`, `case_kanak_icone.png`, `case_kanak_tribu.png`).

## Images d'un événement

- **Image principale** (`events.image_id`) : la première affichée dans la fiche.
- **Autres images** (table `event_images`) : affichées ensuite, en **défilement horizontal**, avec un compteur « 2 / 4 » et des flèches ‹ ›.
- Chaque image a une **description** (texte alternatif), un **crédit** et une **page d'origine**. Le crédit s'affiche sous l'image ; il devient un lien si la page d'origine est connue.

Se règle dans l'administration : champs « Image » et « Autres images » d'un événement (voir [administration.md](administration.md)).

### Conseils

- Réduire les images lourdes avant de les ajouter : au-delà d'environ 200 Ko, convertir en WebP, 1 400 pixels de large au maximum, qualité 80 environ.
- Toujours renseigner le **crédit** (auteur, agence, licence). `npm run check-data` liste les images sans crédit.
- Les photos d'agences (Getty Images, Alamy, ABACA, AFP…) sont soumises à des droits : vérifier qu'elles peuvent être utilisées.
- Vérifier que la photo montre bien l'événement (lieu et date).

## Logos sur la carte

Un événement peut avoir un **logo** qui remplace le point de sa catégorie sur la carte et s'affiche en tête de sa fiche. Les logos sont dans `images/logos/` et se choisissent dans la liste « Logo sur la carte » de l'administration.

| Type | Exemples |
|---|---|
| Drapeaux | Kanaky, France, France libre, Royaume-Uni, États-Unis, Japon, Wallis |
| Symboles | casse-tête (conflits), bateau de colons, bible, foulard rouge, usine de nickel (animée), billet de franc Pacifique (animé) |
| Scrutins | urne (`urne.svg`), urne barrée pour un boycott (`urne_boycott.svg`) |
| Partis et organisations | Union calédonienne, Palika, RPC, USTKE, Rhéébù Nùù, Parti communiste, Parti travailliste, Calédonie ensemble, Radio Djiido, Mélanésia 2000 |
| Personnes | tête du président en visite (de Gaulle, Mitterrand, Chirac, Hollande, Macron), Édouard Philippe, Ataï |
| Autres | chapeau de diplômé |

### Fabriquer un logo

- **PNG** : 160 × 160 pixels, rond, sur fond transparent ; les logos de partis et les têtes ont un anneau de couleur.
- **SVG** : pour les dessins simples ou animés (urne, usine, billet, chapeau de diplômé), `viewBox="0 0 64 64"`.
- Les fichiers d'origine de certains logos sont gardés dans `assets-sources/`.

Un événement **avec logo** n'est jamais regroupé avec d'autres sur la carte (voir [carte.md](carte.md)).

## Images des communes

Une commune peut avoir une image (champ « Image » de l'onglet Communes), affichée en haut de sa fiche avec son crédit.
