# Brief d'audit Claude - corps du registre de connaissances

## Mission préparée

Auditer en lecture seule les plafonds HTTP du registre de connaissances et le
dépôt privé direct des documents de l'agent.

## Fichiers à examiner

- `api/knowledge/admin/index.ts`
- `api/knowledge/admin/versions/[id].ts`
- `api/knowledge/admin/versions/[id]/evaluations.ts`
- `api/knowledge/admin/versions/[id]/action.ts`
- `api/knowledge/admin/sources/[id]/action.ts`
- `api/knowledge/admin/documents/index.ts`
- `api/knowledge/admin/documents/[id]/confirm.ts`
- `api/knowledge/admin/documents/[id]/review.ts`
- `scripts/test-knowledge-request-body-bounds.mjs`

## Questions

1. Tous les corps sont-ils bornés avant validation et persistance ?
2. La confirmation sans payload désactive-t-elle entièrement le parseur ?
3. Le document reste-t-il envoyé directement au stockage privé signé ?
4. Le rôle de gestionnaire est-il conservé sur toutes les routes ?

## État d'exécution

Audit non lancé : le modèle Claude exact et le plafond de jetons propres à cette
mission n'ont pas été fournis. Aucun jeton externe n'a été consommé.
