# File en attente de l'usager - preview

## Comportement livré

- L'onglet `En attente` affiche les dossiers au statut
  `attente_demandeur`.
- Le compteur reste calculé côté serveur dans le périmètre autorisé de l'agent.
- La recherche, le service et la pagination continuent à s'appliquer.
- Aucun message, rappel, SMS, email ou changement d'état n'est produit par le
  filtre.

## Vérifications

- `npm run test:support-waiting-queue` vérifie le statut exact et l'absence de
  route de relance dans l'interface.
- La recette Playwright utilise uniquement le dossier fictif
  `BC-TEST-ATTENTE-001`.
- À `320 x 800` et `1440 x 900`, l'onglet est actif, la largeur du document
  reste égale à celle de l'écran, aucune erreur navigateur n'est remontée et
  aucune surcouche plein écran ne masque l'interface.
- T029 reste ouverte jusqu'à validation des horaires, délais, responsables et
  canaux de relance.
