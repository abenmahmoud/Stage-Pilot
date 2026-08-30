# Brief d'audit Claude - surveillance des échéances

## Mission proposée

Auditer uniquement le retrait du délai automatique de vingt-quatre heures, le
filtre serveur des demandes échues et son exposition dans la file agent.
Rechercher un contournement du périmètre établissement/service, un dossier clos
marqué en retard, une date absente traitée comme échue, une relance implicite ou
une promesse de délai non validée.

## Fichiers à examiner

- `api/support/requests/index.ts`
- `api/support/agent/requests/index.ts`
- `shared/support-queue-policy.ts`
- `src/pages/prototype/LyceeConnectPrototype.tsx`
- `scripts/test-support-queue-policy.mjs`
- `scripts/test-support-sla-monitoring.mjs`

## Sortie attendue

Constats classés par gravité avec fichier et ligne, risques résiduels, tests
manquants et verdict limité à la preview. Ne proposer aucun délai, responsable
ou canal sans validation métier explicite.

## État d'exécution

Non exécuté. Le modèle Claude exact et le plafond de jetons propres à cette
mission n'ont pas été fournis ; aucun jeton externe n'a été consommé.
