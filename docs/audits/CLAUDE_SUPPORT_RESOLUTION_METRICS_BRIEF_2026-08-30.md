# Revue indépendante à autoriser - indicateurs de résolution

## Statut

Préparée, non exécutée. Une autorisation courante doit nommer le modèle Claude,
confirmer ce périmètre et fixer un plafond de consommation.

## Objectif unique

Chercher une fuite inter-établissements, un calcul trompeur ou une exposition de
donnée personnelle dans les indicateurs de résolution, sans modifier les fichiers.

## Périmètre en lecture seule

- `api/support/agent/operations/index.ts`
- `src/pages/admin/SupportOperationsPage.tsx`
- `scripts/test-support-resolution-metrics.mjs`
- `docs/operations/SUPPORT_RESOLUTION_METRICS_PREVIEW_2026-08-30.md`

## Livrable attendu

Constats P0 à P3 avec fichier et ligne, scénario, correction minimale et test
manquant. Vérifier le filtre établissement sur chaque requête, la définition du
taux, la cohorte des délais, le stock ouvert, le cas vide et l'absence d'identité,
de coordonnées, de texte libre et de référence de dossier dans la réponse.

## Interdictions

Pas de commande, pas d'écriture, pas de réseau, pas de secret, pas de lecture de
données réelles et pas de production. Arrêt après un rapport unique.
