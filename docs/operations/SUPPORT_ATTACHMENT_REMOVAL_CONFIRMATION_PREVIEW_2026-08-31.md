# Retrait confirmé des brouillons agent - preview

## Comportement livré

- Le navigateur conserve une clé UUID pour une même pièce tant que son retrait
  n'est pas confirmé et relu.
- Le serveur vérifie d'abord si cette clé possède déjà un événement final, même
  lorsque la ligne de pièce a disparu.
- La suppression initiale produit `attachment.draft_removed`. Une course déjà
  gagnée par un autre appel du même agent produit
  `attachment.draft_removal_reused` sans seconde suppression.
- Une clé liée à une autre action, une autre pièce ou un autre agent est refusée.
- La console relit le dossier et exige que l'identifiant ne soit plus présent
  avant de modifier l'écran.

## Confidentialité et limites

- Le reçu contient seulement le numéro de dossier, l'identifiant opaque de la
  pièce, la date PostgreSQL, l'indicateur de rejeu et la référence de confirmation.
- Aucun nom, chemin privé, URL signée, contenu ou identifiant d'agent n'est renvoyé.
- Ce lot n'ajoute aucune migration et n'utilise aucun fichier ou compte réel.
