# Remise à zéro des filtres agent - preview

## Comportement livré

- Une action icône rétablit la recherche vide, la file `Toutes`, tous les
  services et la première page.
- L'action porte le nom accessible `Réinitialiser les filtres`.
- Elle est désactivée lorsque la vue est déjà dans cet état.
- Les deux actions icônes conservent une largeur stable de 40 px.

## Vérifications

- Le test automatisé contrôle les quatre états remis à zéro et la grille.
- La recette Playwright à `320 x 800` combine recherche `test`, file `En attente`
  et service `Administration`, puis actionne la remise à zéro.
- Recherche et service redeviennent vides, `Toutes` redevient actif, le bouton se
  désactive, la page ne déborde pas et aucune erreur navigateur n'apparaît.
