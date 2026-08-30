# Revue indépendante à autoriser - convergence phase 7

## Statut

Préparée, non exécutée. Une mission Claude devra encore préciser le modèle exact,
ce périmètre et un plafond de jetons ; aucun jeton externe n'est consommé ici.

## Objectif unique

Vérifier que T055 peut être fermée techniquement sans fermer à tort les décisions
humaines de T053 et T054.

## Périmètre en lecture seule

- `specs/002-agent-etablissement-adaptatif/tasks.md`
- `specs/003-gestion-contenus-lycee/tasks.md`
- `specs/003-gestion-contenus-lycee/validation.md`
- `specs/004-reprise-site-officiel/tasks.md`
- `content/legacy-site/coverage-baseline.md`
- `docs/operations/PORTAL_PHASE7_CONVERGENCE_2026-08-30.md`

## Livrable attendu

Constats P0 à P3 avec référence exacte, contradiction éventuelle, tâche fermée à
tort ou preuve manquante. Séparer systématiquement livraison technique,
validation métier, publication et bascule de production.

## Interdictions

Pas de commande, d'écriture, de réseau, de secret, de donnée réelle, de VPS ou de
production. Arrêt après un rapport unique.
