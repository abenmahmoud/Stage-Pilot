# Revue indépendante à autoriser - test de charge du support

## Statut

Préparée, non exécutée. Une autorisation courante doit nommer le modèle Claude,
confirmer ce périmètre et fixer un plafond de consommation.

## Objectif unique

Vérifier que le test de charge ne peut viser la production, supprimer une donnée
hors recette ou mélanger deux établissements, sans exécuter le script ni modifier
les fichiers.

## Périmètre en lecture seule

- `scripts/load-test-support.mjs`
- `scripts/test-load-support-safety.mjs`
- `specs/001-guichet-numerique/tasks.md`, tâches T012 et T012A

## Livrable attendu

Constats P0 à P3 avec fichier et ligne, scénario, correctif minimal et test
manquant. Vérifier les trois verrous de cible, le préfixe aléatoire, la file
temporaire, les bornes de concurrence et le nettoyage en cas d'échec.

## Interdictions

Pas de commande, pas d'écriture, pas de réseau, pas de secret et pas de
production. Arrêt après un rapport unique.
