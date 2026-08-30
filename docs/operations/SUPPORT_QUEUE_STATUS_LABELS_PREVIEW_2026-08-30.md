# Statuts lisibles dans la file - preview

## Comportement livré

- Chaque ligne de demande affiche un statut en français.
- `attente_demandeur` devient `En attente usager` pour l'agent.
- `attente_interne` devient `À vérifier` pour reprendre le libellé de la file.
- Le badge de statut possède un style neutre, distinct des alertes.

## Vérifications

- `npm run test:support-queue-status-labels` couvre les neuf statuts et la
  séparation des alertes.
- La recette Playwright utilise `BC-TEST-BADGES-001` avec six badges simultanés :
  statut, urgence, rappel, doublon, absence d'agent et retard.
- À `320 x 800` et `1440 x 900`, les six badges restent dans leur ligne, sans
  chevauchement, sans débordement horizontal et sans erreur navigateur.
