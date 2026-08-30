# Brief d'audit Claude - observabilité de l'agent

## Mission proposée

Auditer la journalisation du modèle, de la latence, des jetons, du coût estimé et
de la décision humaine de routage. Rechercher une donnée nominative, un coût
présenté comme facture, une validation humaine déduite d'un succès technique, un
reçu rejouable, une métrique modifiable ou un croisement d'établissement.

## Fichiers à examiner

- `shared/agent-runtime-metrics.ts`
- `api/_shared/agent-runtime-metrics.ts`
- `api/_shared/support-agent.ts`
- `api/support/agent/metrics.ts`
- `api/support/requests/index.ts`
- `api/support/agent/requests/[code].ts`
- `src/pages/admin/SupportOperationsPage.tsx`
- `scripts/test-agent-runtime-metrics.mjs`
- `scripts/test-support-assistant-routing-review.mjs`

## Sortie attendue

Constats classés par gravité avec fichier et ligne, risque de corrélation ou de
surinterprétation, test manquant et verdict limité à la preview.

## État d'exécution

Non exécuté. Le modèle Claude exact et le plafond de jetons propres à cette
mission n'ont pas été fournis ; aucun jeton externe n'a été consommé.
