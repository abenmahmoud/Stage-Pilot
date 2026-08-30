# Brief d'audit Claude - guichet unique de suivi

## Mission proposée

Vérifier que le dialogue libre, le formulaire classique, le suivi demandeur et
la console agent convergent réellement vers le guichet `001`. Rechercher une
écriture cachée de l'assistant, une table parallèle, une perte d'idempotence, un
historique divergent ou une pièce jointe rattachée à un autre système.

## Fichiers à examiner

- `src/pages/prototype/LyceeConnectPrototype.tsx`
- `api/support/assistant.ts`
- `api/support/requests/index.ts`
- `api/support/requests/[code].ts`
- `api/support/requests/[code]/messages.ts`
- `api/support/agent/requests/index.ts`
- `api/support/agent/requests/[code].ts`
- `specs/002-agent-etablissement-adaptatif/data-model.md`
- `scripts/test-support-single-tracking-system.mjs`

## Sortie attendue

Constats classés par gravité, avec fichier et ligne, scénario de divergence et
test manquant. Le verdict doit rester limité à la preview et ne doit demander
aucune donnée réelle.

## État d'exécution

Non exécuté. Le modèle Claude exact et le plafond de jetons propres à cette
mission n'ont pas été fournis ; aucun jeton externe n'a été consommé.
