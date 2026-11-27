# Contributions des visiteurs

Les visiteurs peuvent proposer des ajouts, des corrections et de nouveaux événements, **sans compte**. Rien n'est publié directement : chaque proposition arrive dans l'administration, qui la relit puis la publie ou la supprime (voir [administration.md](administration.md)).

Ces boutons n'apparaissent que si l'adresse du service des demandes est configurée (`VITE_DEMANDES_URL`, voir [hors-ligne-et-publication.md](hors-ligne-et-publication.md)).

## Boutons « Ajouter » et « Modifier » d'une fiche

En bas de chaque fiche d'événement, de tribu et de commune. Code : `src/components/ProposeButton.vue`.

### Ajouter

Pour compléter la fiche sans toucher à l'existant :

- **Informations à ajouter** (texte libre, obligatoire) : elles s'ajouteront à la suite du texte principal (description, origines ou histoire) ;
- pour une tribu, une **date** facultative : l'ajout devient alors un « événement marquant » de la tribu.

### Modifier

Pour corriger la fiche : le formulaire est prérempli avec le contenu actuel.

| Fiche | Champs modifiables |
|---|---|
| Événement | titre, date, date de fin, lieu, description |
| Tribu | nom, nom local, origines |
| Commune | présentation, histoire |

Les **sources actuelles** peuvent être corrigées ou supprimées (bouton « Supprimer », annulable avec « Rétablir »). Seuls les champs réellement modifiés sont envoyés.

### Commun aux deux

- **Source** recommandée : titre (livre, article, personne…) et lien.
- **Message à l'administration** et **nom ou contact**, facultatifs, visibles seulement par l'administration.
- Bouton « Envoyer la demande ».

## Bouton « Ajouter un événement » de l'en-tête

Code : `src/components/ProposeEventButton.vue`. Il ouvre le même formulaire que l'administration : titre, date, catégorie, lieu (choix d'une commune ou d'une tribu, ou clic sur une carte), description, logo, image (par lien seulement), sources et vidéos. Le nouvel événement n'est créé que lorsque l'administration publie la demande.

## Brouillons et envois différés

- **Brouillon** : ce qui est tapé est gardé dans le navigateur pendant 30 jours. En rouvrant le formulaire, on le retrouve ; le lien « Repartir de zéro » l'efface. Si la fiche a changé entre-temps, les champs repartent de la version actuelle.
- **Service indisponible** : la demande est gardée dans le navigateur et renvoyée automatiquement lors d'une prochaine visite, sans doublon. Un encart en haut à droite le signale.

## Limites et protections

- 5 envois par heure au maximum depuis une même connexion.
- Longueurs maximales : 8 000 caractères pour un texte, 400 pour un titre de source, 1 000 pour un lien.
- Les liens doivent commencer par `https://`.
- Un champ invisible piège les robots.

Les règles sont dans `src/db/proposals.js` ; elles sont partagées par le site, l'administration et le service des demandes.
