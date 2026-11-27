# Tribus, communes, aires coutumières et provinces

Quatre boutons de l'en-tête ajoutent des informations sur la carte, en plus des événements. Sur mobile, leurs libellés sont raccourcis (« Tribus », « Communes », « Aires », « Provinces »).

Code : `src/App.vue` (boutons) et `src/components/MapView.vue` (affichage).

## Tribus

- Bouton **« Afficher les tribus »** : les 347 tribus apparaissent, chacune sous la forme d'une petite case.
- Les cases sont **sous les points d'événements**.
- Survol : nom de la tribu, commune et aire coutumière. Clic : fiche de la tribu (voir [fiches.md](fiches.md)).
- La tribu ouverte est mise en avant (case agrandie et lumineuse).
- L'affichage des tribus ne dépend pas de l'année choisie.

## Communes

- Bouton **« Afficher les communes »** : les 33 communes apparaissent avec leur nom.
- Clic : fiche de la commune, avec la liste de ses tribus.

## Tribus ou communes, pas les deux

On affiche **soit les tribus, soit les communes**. Activer l'un des deux boutons désactive l'autre.

## Aires coutumières et provinces

- **« Afficher les aires coutumières »** : les 8 aires coutumières sont coloriées sur la carte, avec leur nom.
- **« Afficher les provinces »** : les 3 provinces (Nord, Sud, Îles Loyauté) sont coloriées.
- Clic sur une zone : fiche de l'aire ou de la province.
- Aires et provinces **ne s'affichent pas en même temps** : activer l'une désactive l'autre.

Les aires et les provinces peuvent s'afficher en même temps que les tribus ou les communes.

## Recherche

La recherche d'une tribu ou d'une commune affiche seulement l'élément trouvé (voir [recherche.md](recherche.md)). Les boutons de l'en-tête font quitter ce mode et réaffichent tout.
