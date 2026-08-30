# Revue indépendante à autoriser - tables techniques du support

## Statut

Préparée, non exécutée. Une autorisation courante doit nommer le modèle Claude,
confirmer ce périmètre et fixer un plafond de consommation.

## Objectif unique

Chercher une fuite inter-établissement, une collision d'idempotence, un webhook
attribué au mauvais établissement ou un contournement de la liaison dossier-job
dans le lot T015B2, sans modifier les fichiers.

## Périmètre en lecture seule

- `db/schema.ts`
- `api/cron/support-worker.ts`
- `workers/support-file-worker.mjs`
- `workers/support-email-worker.mjs`
- `api/support/attachments/[id]/confirm.ts`
- `api/webhooks/brevo/inbound.ts`
- `api/webhooks/brevo/delivery.ts`
- `api/support/agent/operations/index.ts`
- `api/support/agent/operations/[id]/retry.ts`
- migrations `20260830041544` et `20260830041931`
- `scripts/test-support-technical-institution-scope.mjs`
- `docs/operations/SUPPORT_INSTITUTION_SCOPE_PREVIEW_2026-08-30.md`

## Livrable attendu

Constats P0 à P3 avec fichier et ligne, scénario d'exploitation, correctif
minimal et test manquant. Vérifier explicitement immuabilité, clés étrangères
composites, rejeu webhook, livraison Brevo, reprise d'échec, RLS et limites de la
file PGMQ partagée. Conclure clairement s'il n'existe aucun constat bloquant.

## Interdictions

Pas de commande, pas d'écriture, pas de réseau, pas de secret, pas de donnée
réelle et pas de production. Arrêt après un rapport unique.
