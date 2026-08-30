# Couverture globale des corps HTTP - aperçu du 30 août 2026

## Objectif

Empêcher qu'une nouvelle route API lise `req.body` sans plafond explicite. Une
requête surdimensionnée doit être rejetée par Vercel avant d'atteindre la logique
métier ou la base de données.

## Contrôle automatique

Le test `test:api-request-body-boundary-coverage` parcourt récursivement les
fichiers TypeScript de `api/`. Pour chaque route qui lit `req.body`, il exige :

- une configuration Vercel exportée ;
- un `bodyParser.sizeLimit` explicite ;
- l'absence de `bodyParser: false`, incompatible avec la lecture de `req.body`.

Le contrôle fait partie de `test:preview-security-gate`. Toute régression bloque
donc le lot avant commit et déploiement de l'aperçu.

## Limites

Ce contrôle statique ne remplace ni la validation des champs, ni les plafonds de
fichiers envoyés directement au stockage privé, ni les tests de charge. Aucun
appel distant, aucune donnée réelle et aucune modification de production ne sont
nécessaires.
