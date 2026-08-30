# Revue indépendante à autoriser - résilience Brevo

## Statut

Préparée, non exécutée. Une autorisation courante doit nommer le modèle Claude,
confirmer ce périmètre et fixer un plafond de consommation.

## Objectif unique

Chercher un scénario de perte, doublon, reçu bloqué, envoi répété ou échec non
reprenable dans T026A, sans modifier les fichiers.

## Périmètre en lecture seule

- `api/_shared/brevo.ts`
- `api/webhooks/brevo/inbound.ts`
- `api/webhooks/brevo/delivery.ts`
- `api/cron/support-worker.ts`
- `workers/support-email-worker.mjs`
- `scripts/test-support-resilience.mjs`
- `docs/operations/SUPPORT_WEBHOOK_RESILIENCE_PREVIEW_2026-08-30.md`

## Livrable attendu

Constats P0 à P3 avec fichier et ligne, scénario, correctif minimal et test
manquant. Vérifier atomicité, rejeu dix fois, panne avant/après envoi, seuil de
file d'échec et reprise manuelle. Distinguer clairement preuve locale et test
Brevo réel encore ouvert.

## Interdictions

Pas de commande, pas d'écriture, pas de réseau, pas de secret, pas d'email et pas
de production. Arrêt après un rapport unique.
