# Reprise du détail agent - preview

## Comportement livré

- Les erreurs de file, de détail et d'action sont conservées séparément.
- Un échec ordinaire du détail propose `Réessayer le dossier` sans recharger la
  file complète.
- Les erreurs de connexion ou de MFA gardent leur parcours dédié et ne proposent
  pas une relance trompeuse.
- Un identifiant de lecture empêche une ancienne réponse de terminer ou remplacer
  une tentative plus récente, même pour le même dossier.

## Vérifications

- Le test dédié est inclus dans la barrière de sécurité permanente.
- La recette navigateur simule un `503`, puis une réussite après action sur
  `Réessayer le dossier`, à 320 x 720 et 1440 x 1000.
- La file reste visible pendant la panne, deux lectures seulement sont émises,
  puis le détail apparaît et l'alerte disparaît.
- Aucun débordement horizontal ni crash JavaScript n'est observé.
