# Brief d'audit Claude - corps des requêtes IA

## Mission préparée

Auditer en lecture seule les limites HTTP des trois routes IA, sans clé ni appel
fournisseur.

## Fichiers à examiner

- `api/support/assistant.ts`
- `api/content/admin/assist.ts`
- `api/communications/admin/assist.ts`
- `scripts/test-ai-request-body-bounds.mjs`

## Questions

1. Un corps géant peut-il atteindre la validation ou le fournisseur IA ?
2. Les plafonds restent-ils compatibles avec toutes les limites métier ?
3. Validation et limite de débit précèdent-elles chaque appel fournisseur ?

## État d'exécution

Audit non lancé : le modèle Claude exact et le plafond de jetons propres à cette
mission n'ont pas été fournis. Aucun jeton externe n'a été consommé.
