# Repères de sélection de la console agent - preview

## Comportement livré

- La section porte le nom accessible `File des demandes`.
- Le champ porte le nom `Rechercher une demande`, indépendamment de son texte
  indicatif.
- La charge par service est un groupe nommé et chaque bouton annonce son état
  sélectionné.
- Chaque ligne de dossier annonce également si elle est la sélection courante.

Les contrôles restent natifs ; aucun comportement clavier personnalisé n'est
ajouté.

## Vérifications

- Le test automatisé contrôle tous les noms et états.
- La recette Playwright à 320 et 1440 px focalise la recherche par son nom,
  active un service avec `Espace` et un dossier avec `Entrée`. Un seul service
  reste pressé, le nouveau dossier passe à `true`, l'ancien à `false`, sans
  erreur navigateur ni débordement horizontal.
