# Les fiches

Un clic sur un élément de la carte ouvre sa fiche. On la ferme avec le bouton ×, la touche Échap ou un clic à côté.

## Fiche d'un événement

Code : `src/components/EventModal.vue`.

Contenu, de haut en bas :

1. **Images** (si l'événement en a), voir « Galerie » ci-dessous.
2. **Logo** ou icône de la catégorie, et **titre**.
3. **Date** et **lieu**. La date est écrite en toutes lettres (« 22 avril 1988 – 5 mai 1988 »), ou remplacée par un texte libre s'il est rempli (« Années 1960-1970 », « 1958 (ou 1957) »).
4. **Description**, en paragraphes.
5. **Vidéos** (liens, par exemple vers l'INA).
6. **Sources et pour aller plus loin**.
7. Boutons **Ajouter** et **Modifier** (voir [contributions.md](contributions.md)).

Navigation : les flèches ← → du clavier passent à l'événement précédent ou suivant dans l'ordre chronologique. L'année et le mois suivent.

### Galerie d'images

Un événement peut avoir **plusieurs images** :

- la première est l'image principale ; les autres suivent ;
- on passe de l'une à l'autre en **faisant défiler horizontalement** (doigt, pavé tactile) ou avec les flèches ‹ › posées sur l'image ;
- un compteur « 2 / 4 » indique la position ;
- le **crédit** sous l'image (auteur, lien vers la page d'origine) change avec l'image affichée.

Chaque image est affichée en entier et centrée ; une copie floutée remplit les côtés.

## Fiche d'une tribu

Code : `src/components/TribuPanel.vue`. Contenu : nom, nom local, localisation (commune et île), aire coutumière, **Origines**, **Événements marquants** (datés), **Sources**, puis les boutons Ajouter et Modifier.

## Fiche d'une commune

Code : `src/components/CommunePanel.vue`. Contenu : image, province, aire coutumière, **Présentation**, **Histoire** (tirée de Wikipédia, ou texte retouché à la main s'il existe), **Tribus de la commune** (un clic ouvre la tribu), **Sources et pour aller plus loin**, puis les boutons Ajouter et Modifier.

## Fiche d'une aire coutumière

Code : `src/components/AirePanel.vue`. Contenu : nom, description, **Communes de l'aire** (un clic affiche la commune), lien vers Wikipédia.

## Fiche d'une province

Code : `src/components/ProvincePanel.vue`. Contenu : nom, chef-lieu, description, **Communes de la province** et **Aires coutumières**.

## Liens partageables

L'adresse de la page change avec la fiche ouverte ; on peut la copier et l'envoyer :

| Adresse | Ouvre |
|---|---|
| `…/#evenement=<identifiant>` | la fiche de l'événement (et son année) |
| `…/#tribu=<identifiant>` | la fiche de la tribu (et active l'affichage des tribus) |
| `…/#commune=<identifiant>` | la fiche de la commune (et active l'affichage des communes) |

Exemple : `#evenement=ouvea-1988`.
