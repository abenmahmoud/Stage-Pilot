# Revue indépendante à autoriser - mesures de l'agent

## Statut

Préparée, non exécutée. Une autorisation courante doit encore nommer le modèle
Claude, confirmer le périmètre ci-dessous et fixer la limite de consommation.

## Objectif unique

Chercher des failles de confidentialité, d'autorisation, d'intégrité, de coût
ou de disponibilité dans les lots T030A/T030B, y compris l'agrégation des
réorientations humaines, sans modifier les fichiers.

## Périmètre en lecture seule

- `shared/agent-runtime-metrics.ts`
- `api/_shared/agent-runtime-metrics.ts`
- `api/_shared/support-agent.ts`
- `api/support/assistant.ts`
- `api/support/agent/metrics.ts`
- `src/pages/admin/SupportOperationsPage.tsx`
- `db/schema.ts`
- migrations `20260830013502` et `20260830014140`
- `scripts/test-agent-runtime-metrics.mjs`

## Livrable attendu

Constats classés P0 à P3 avec fichier et ligne, scénario d'exploitation,
correctif minimal et test manquant. Conclure explicitement s'il n'existe aucun
constat bloquant.

## Interdictions

Pas de commande, pas d'écriture, pas de réseau, pas de secret, pas de donnée
réelle, pas de modification de production. Arrêt après un rapport unique.
