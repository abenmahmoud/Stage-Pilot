# Revue indépendante à autoriser - confirmation de demande

## Statut

Préparée, non exécutée. L'autorisation doit encore nommer le modèle Claude,
confirmer ce périmètre et fixer un plafond de consommation.

## Objectif unique

Chercher une fausse réussite, une confusion idempotente ou une confirmation
forgeable dans le parcours public de création de demande, sans modifier les
fichiers.

## Périmètre en lecture seule

- `shared/support-request-confirmation.ts`
- `api/support/requests/index.ts`
- `src/pages/prototype/LyceeConnectPrototype.tsx`
- `scripts/test-support-request-confirmation.mjs`
- `docs/operations/SUPPORT_REQUEST_CONFIRMATION_PREVIEW_2026-08-30.md`

## Livrable attendu

Constats P0 à P3 avec fichier et ligne, scénario, correction minimale et test
manquant. Vérifier les réponses concurrentes et idempotentes, l'ordre entre
transaction, confirmation, pièces jointes, mémoire locale et réussite visible,
ainsi que l'absence de succès simulé lorsque l'API est désactivée.

## Interdictions

Pas de commande, pas d'écriture, pas de réseau, pas de secret, pas de donnée
réelle et pas de production. Arrêt après un rapport unique.
