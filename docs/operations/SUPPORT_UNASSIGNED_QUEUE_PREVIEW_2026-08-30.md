# File des dossiers sans agent - preview

## Comportement livré

- L'onglet `Sans agent` filtre les demandes dont `assignedTo` est vide.
- Le filtre est ajouté après le périmètre d'établissement et de service.
- Un agent limité ne voit donc que les demandes sans agent de ses services.
- Le filtre `À orienter` reste réservé aux dossiers sans service assigné.

## Limites

La file ne prend aucun dossier automatiquement et ne notifie personne. Les
règles d'attribution ou d'escalade restent soumises à validation métier.

## Vérifications

- `npm run test:support-unassigned-queue` contrôle le filtre et la distinction
  entre absence d'agent et absence de service.
- Les tests d'accès et les scénarios adverses confirment le cloisonnement des
  agents limités à leurs services.
- Une recette Playwright avec `BC-TEST-SANS-AGENT-001` confirme l'onglet actif à
  `320 x 800` et `1440 x 900`, sans débordement, erreur ni surcouche bloquante.
