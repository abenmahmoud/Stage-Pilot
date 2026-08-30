# Matrice de couverture WordPress - preview

## Résultat

- `28/28` contenus inventoriés ont une ligne de comparaison et un brouillon.
- `27/27` anciennes adresses hors accueil ont une redirection versionnée.
- `15` contenus durables, `7` archives et `6` contenus à confirmer restent à
  relire par un responsable humain.
- Le PDF du voyage à Londres reste bloqué ; aucun contournement de la limite de
  10 Mo n'a été ajouté.

La matrice source est
`content/legacy-site/coverage-baseline.md`. Le test
`npm run test:legacy-coverage` refuse une disparition, un doublon, une
redirection incohérente ou la dissimulation du média bloquant.

## Limites

Ce lot n'a lu ni modifié la production, Hostinger, le DNS, le VPS, le Webmail,
l'ENT ou PRONOTE. Il n'a importé, publié ni supprimé aucun contenu. La tâche
parente T018 reste ouverte jusqu'à la recette visuelle et éditoriale réelle.

## Audit des dépendances

`npm audit --omit=dev --audit-level=high` ne remonte aucune vulnérabilité dans
les dépendances livrées en production. L'audit complet remonte toutefois trois
alertes hautes et six modérées dans la chaîne de développement transitivement
amenée par `@vercel/node` et `drizzle-kit`. Le correctif automatique proposé est
cassant et rétrograde des paquets ; il n'a donc pas été exécuté. Ce risque de
toolchain reste à suivre séparément lors d'une mise à niveau contrôlée.
