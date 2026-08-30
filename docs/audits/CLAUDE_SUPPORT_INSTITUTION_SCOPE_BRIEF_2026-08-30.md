# Revue indépendante à autoriser - cloisonnement établissement

## Statut

Préparée, non exécutée. Une autorisation courante doit encore nommer le modèle
Claude, confirmer ce périmètre et fixer une limite de consommation.

## Objectif unique

Chercher une fuite inter-établissement, un contournement de rôle ou service, une
collision d'idempotence, une confusion de tâche email ou une régression de suivi
dans le lot T015B1, sans modifier les fichiers.

## Périmètre en lecture seule

- `api/_shared/institution-context.ts`
- `api/_shared/support-agent-access.ts`
- `api/_shared/support.ts`
- routes sous `api/support/requests` et `api/support/agent/requests`
- `api/support/access/[token].ts`
- `api/support/agent/attachments/[id].ts`
- `api/support/agent/operations`
- `api/support/agent/metrics.ts`
- `api/cron/support-worker.ts`
- `api/webhooks/brevo/inbound.ts`
- `db/schema.ts`
- migration `20260830020355`
- `scripts/test-support-institution-scope.mjs`

## Livrable attendu

Constats P0 à P3 avec fichier et ligne, scénario d'exploitation, correctif
minimal et test manquant. Vérifier explicitement lecture, écriture, idempotence,
sessions, pièces, email entrant, file de jobs et métriques. Conclure s'il
n'existe aucun constat bloquant.

## Interdictions

Pas de commande, pas d'écriture, pas de réseau, pas de secret, pas de donnée
réelle et pas de production. Arrêt après un rapport unique.
