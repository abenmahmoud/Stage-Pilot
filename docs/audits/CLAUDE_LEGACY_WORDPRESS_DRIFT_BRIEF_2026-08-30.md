# Revue indépendante à autoriser - dérive du site historique

## Statut

Préparée, non exécutée. Une mission Claude devra encore préciser le modèle exact,
ce périmètre et un plafond de jetons ; aucun jeton externe n'est consommé ici.

## Objectif unique

Chercher une manière de tromper, contourner ou épuiser le contrôle en lecture
seule qui compare contenus, médias et catégories de l'inventaire LyceeGest au
WordPress public officiel.

## Périmètre en lecture seule

- `scripts/check-legacy-wordpress-drift.mjs`
- `scripts/test-legacy-wordpress-drift.mjs`
- `content/legacy-site/inventory.json`
- `content/legacy-site/coverage-baseline.md`
- `specs/004-reprise-site-officiel/tasks.md`

## Livrable attendu

Constats P0 à P3 avec fichier, ligne, scénario reproductible, impact, correctif
minimal et test manquant. Vérifier SSRF, redirections, réponses chunkées,
compression, tailles annoncées ou réelles, JSON hostile, doublons, changements
de titre/date/adresse, pagination, médias déclarés mais inaccessibles et risque
de faux positif ou faux négatif.

## Interdictions

Pas de commande, d'écriture, de réseau, de secret, de donnée réelle, de VPS ou de
production. Arrêt après un rapport unique.
