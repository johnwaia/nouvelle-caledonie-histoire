# La recherche

La barre de recherche est en haut à gauche de la carte. Trois onglets choisissent ce que l'on cherche.

Code : `src/components/SearchBox.vue`.

| Onglet | On cherche par | Quand on choisit un résultat |
|---|---|---|
| **Tribus** | nom ou nom local | la carte n'affiche plus que cette tribu, zoome dessus et ouvre sa fiche |
| **Communes** | nom | la carte n'affiche plus que cette commune, zoome dessus et ouvre sa fiche |
| **Événements** | titre, lieu ou année (« 1988 », « Ouvéa », « grotte ») | la fiche de l'événement s'ouvre, et la frise passe à son année |

## Fonctionnement

- Les accents et les majuscules ne comptent pas : « ouvea » trouve « Ouvéa ».
- Les résultats dont un mot **commence** par la recherche viennent en premier, puis ceux qui la **contiennent**.
- Tribus et communes sont classées par ordre alphabétique, les événements par ordre chronologique.
- 30 résultats au maximum.
- Sous chaque résultat : la commune (tribus), la province (communes), ou la date et le lieu (événements).
- Dans l'onglet « Communes », la liste complète s'affiche avant même de taper.

## Clavier

- ↓ ↑ : se déplacer dans les résultats ;
- Entrée : choisir le résultat en surbrillance ;
- Échap : fermer la liste.

## Revenir à l'affichage complet

Après le choix d'une tribu ou d'une commune, un bandeau « Affiché : Tribu de … » apparaît sous la barre. Son bouton × réaffiche tout. Les boutons de l'en-tête (Tribus, Communes…) le font aussi.
