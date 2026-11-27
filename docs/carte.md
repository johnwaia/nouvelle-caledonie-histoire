# La carte

La carte occupe tout l'écran. Elle montre les événements de **l'année choisie** dans la frise (voir [frise-annees-mois.md](frise-annees-mois.md)).

Code : `src/components/MapView.vue`.

## Fond de carte

- Fond épuré Esri « Light Gray Canvas ». Les terres y sont recolorées en vert directement dans le navigateur, et les principaux noms de lieux sont ajoutés par-dessus.
- Le bouton **i** en bas à gauche affiche les crédits obligatoires (Esri, OpenStreetMap, DITTT pour les tribus) et le lien vers l'administration.
- Les boutons **+** et **−** zooment ; on peut aussi pincer (mobile) ou utiliser la molette.

## Points d'événements

Chaque événement situé dans l'archipel est un point sur la carte.

- **Logo** : si l'événement a un logo (drapeau, casse-tête, usine, tête d'un président en visite, logo d'un parti…), il est affiché à la place du point. Sinon, c'est l'icône de sa catégorie, dans la couleur de la catégorie.
- **Référendums** : une urne, barrée d'une croix rouge si le scrutin a été boycotté (1987 et 2021).
- **Survol** (ordinateur) : une bulle donne le titre, la date et le lieu (pour un groupe : le nombre d'événements, la catégorie et le lieu).
- **Clic** : ouvre la fiche de l'événement (voir [fiches.md](fiches.md)).
- **Changement d'année** : les anciens points s'effacent en fondu pendant que les nouveaux apparaissent.

## Placement des points

Plusieurs événements peuvent avoir lieu au même endroit (Nouméa surtout). Les points s'écartent alors automatiquement :

- chaque point reste **au plus près de son lieu**, sans recouvrir un autre point ;
- autant que possible, il reste **sur la terre ferme**, et sur **la même île** que son lieu (un point de Lifou ne part pas sur Maré) ;
- l'**ordre nord-sud** est respecté : un lieu plus au nord garde son point au-dessus de celui d'un lieu plus au sud (Koumac au-dessus de Voh, par exemple) ;
- les logos « plantés » (drapeaux) gardent leur pied sur la terre ;
- un événement marqué « **Placer sous les autres points de l'année** » est posé sous les autres points, s'il reste de la terre en dessous (utilisé pour les drapeaux de 1984).

Les positions sont recalculées à chaque zoom.

## Groupes de points

Quand une même année compte plusieurs événements **de la même catégorie, exactement au même endroit et sans logo propre**, ils sont réunis en un seul point qui porte un **nombre** (le nombre d'événements).

- **Clic sur un groupe** : le groupe s'ouvre et ses événements s'affichent autour du lieu. Sur mobile, la carte zoome d'abord sur le lieu puis ouvre le groupe.
- **Zoom avant** (niveau 10 ou plus) : les groupes se défont automatiquement, chaque événement a son point.
- **Zoom arrière** : les groupes se reforment automatiquement.
- Un événement qui a un logo n'est jamais regroupé.

## Zoom sur un événement

- Quand une fiche s'ouvre, la carte **zoome sur le lieu** de l'événement (niveau 10 au minimum).
- La vue d'ensemble de l'archipel revient :
  - quand on **change d'année** ;
  - quand on **ferme la fiche**, sauf si l'événement fait partie d'un groupe dont tous les événements n'ont pas encore été consultés. On peut ainsi parcourir les événements d'un groupe sans que la carte se dézoome entre chacun.

## Événements hors de l'archipel

Les événements sans coordonnées (Paris, New York, Tahiti, Bougival…) n'ont pas de point. Ils sont listés dans l'encart **« Hors de l'archipel »**, en bas à droite. Un clic sur un titre ouvre sa fiche. Si l'année ne compte que des événements hors de l'archipel, un message l'indique en haut de la carte.

## Réglages (dans `MapView.vue`)

| Constante | Valeur | Rôle |
|---|---|---|
| `GROUP_ZOOM` | 10 | Niveau de zoom à partir duquel les groupes se défont |
| `EVENT_ZOOM` | 10 | Zoom minimal quand une fiche s'ouvre |
| `ORDER_GAP` | 15 px | Écart vertical à partir duquel l'ordre nord-sud de deux lieux est respecté |
| `PIN_GAP` | 3 px | Espace minimal entre deux points |
| `SOUTH_REACH` | 65 px | Éloignement maximal d'un point « placé sous les autres » |
