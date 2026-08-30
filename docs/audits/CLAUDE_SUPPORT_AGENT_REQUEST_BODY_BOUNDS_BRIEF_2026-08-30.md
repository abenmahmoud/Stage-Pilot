# Brief d'audit Claude - corps des mutations agent

## Mission préparée

Auditer en lecture seule les plafonds HTTP des mutations de la console agent.

## Fichiers à examiner

- `api/support/agent/approvals/[id]/decision.ts`
- `api/support/agent/operations/[id]/retry.ts`
- `api/support/agent/templates.ts`
- `api/support/agent/requests/[code].ts`
- `scripts/test-support-agent-request-body-bounds.mjs`

## Questions

1. Un corps géant peut-il atteindre une décision ou une mise à jour de dossier ?
2. La reprise technique peut-elle consommer un corps qu'elle n'utilise pas ?
3. Authentification, périmètre et limites de débit restent-ils en place ?

## État d'exécution

Audit non lancé : le modèle Claude exact et le plafond de jetons propres à cette
mission n'ont pas été fournis. Aucun jeton externe n'a été consommé.
