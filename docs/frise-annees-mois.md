# Frise chronologique, années et mois

Code : `src/components/TimelineBar.vue` (frise) et `src/App.vue` (année et mois choisis).

## La frise

- En bas de l'écran, une frise en carrousel présente **une case par année qui compte au moins un événement**. Les années sans événement n'y figurent pas.
- L'année choisie est **centrée et mise en avant**.
- Pour changer d'année :
  - faire défiler la frise (molette, glisser, doigt) : l'année qui s'arrête au centre est choisie ;
  - cliquer sur une année ou sur les flèches ‹ › ;
  - choisir dans la liste déroulante « Choisir l'année » à gauche ;
  - au clavier : ← → (année précédente ou suivante), Début et Fin (première et dernière année).
- Les années avant notre ère s'affichent « av. J.-C. » (par exemple « 1100 av. J.-C. »).

## Une année à la fois

La carte n'affiche que les événements de l'année choisie. À l'ouverture du site, c'est la première année de la frise.

Quand on ouvre un événement (lien partagé, recherche, encart « Hors de l'archipel », fiche suivante), la frise se place automatiquement sur son année.

## Boutons de mois

Certaines années sont très chargées. Pour ne pas surcharger la carte, elles ont une **barre de mois** en bas de la carte :

- un bouton par mois qui compte au moins un événement (par exemple « janv. », « avril », « sept. ») ;
- un bouton « Mois inconnu » si certains événements n'ont qu'une année pour date ;
- la carte n'affiche que les événements du mois choisi ;
- à l'arrivée sur l'année, le **premier mois** est choisi ;
- si l'on ouvre un événement d'un autre mois (lien, recherche, fiche suivante), le mois change pour qu'il reste visible.

### Quelles années ont des mois ?

- automatiquement, toute année qui compte **au moins 10 événements** (aujourd'hui : 1985) ;
- en plus, les années listées dans `MONTH_YEARS` (`src/App.vue`) : aujourd'hui **1981 et 1984**.

Pour ajouter une année, ajouter son numéro dans `MONTH_YEARS`. Pour changer le seuil automatique, modifier `MONTHS_FROM`.
