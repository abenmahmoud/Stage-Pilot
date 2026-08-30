# États de chargement de la console agent - preview

## Comportement livré

- Une actualisation conserve les lignes déjà visibles et affiche un bandeau
  discret `Mise à jour…` dans la file.
- La file et le détail exposent `aria-busy` ; les deux messages de chargement
  utilisent un statut poli pour les aides techniques.
- Le message de file vide apparaît uniquement après la fin du chargement.
- Un changement de dossier efface immédiatement l'ancien détail avant de charger
  le nouveau, afin de ne jamais associer un contenu à la mauvaise sélection.

## Vérifications

- Le test automatisé contrôle les états, les annonces et les gardes de course.
- La recette Playwright retarde la file de 500 ms et le second détail de 650 ms.
  À 320 et 1440 px, `aria-busy` vaut `true` pendant chaque attente, l'ancien
  détail est absent, aucune erreur navigateur n'apparaît et la largeur du
  document reste exactement celle de la fenêtre.
