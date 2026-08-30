# Validation de la liste publique - preview

## Comportement livré

- La liste `Mes demandes` est lue comme une donnée inconnue puis validée avant
  toute notification, mémoire locale ou mise à jour de l'écran.
- Chaque dossier possède un numéro public conforme, des champs bornés, une
  catégorie, un statut et une priorité connus ainsi que des dates cohérentes.
- La réponse contient au plus 200 numéros distincts.
- Un identifiant de lecture empêche une actualisation réseau ancienne de
  remplacer la liste la plus récente.

## Vérifications

- Le test dédié est inclus dans la barrière de sécurité permanente.
- La recette navigateur injecte une catégorie, un statut, une date et un objet
  invalides à 320 x 720 et 1440 x 1000.
- L'application refuse la réponse, n'affiche aucun faux dossier et conserve un
  état vide explicite, sans erreur JavaScript ni débordement horizontal.
- Le build, la porte de sécurité et l'audit npm passent ; aucune donnée réelle
  ou intégration distante n'a été utilisée.
