# Brief d'audit Claude - corps du centre de communications

## Mission préparée

Auditer en lecture seule les plafonds HTTP des mutations du centre de
communications et la séparation de leurs autorisations.

## Fichiers à examiner

- `api/communications/admin/index.ts`
- `api/communications/admin/templates.ts`
- `api/communications/admin/[id]/index.ts`
- `api/communications/admin/[id]/review.ts`
- `api/communications/admin/[id]/approve.ts`
- `api/communications/admin/[id]/publish.ts`
- `api/communications/admin/documents/index.ts`
- `scripts/test-communication-request-body-bounds.mjs`

## Questions

1. Les limites HTTP couvrent-elles tous les corps avant validation métier ?
2. Les plafonds autorisent-ils les tailles métier sans marge excessive ?
3. Le fichier source reste-t-il envoyé directement au stockage privé signé ?
4. Les rôles rédaction, direction et publication restent-ils distincts ?

## État d'exécution

Audit non lancé : le modèle Claude exact et le plafond de jetons propres à cette
mission n'ont pas été fournis. Aucun jeton externe n'a été consommé.
