# Brief d'audit Claude - corps des commandes d'identité

## Mission préparée

Auditer en lecture seule les plafonds HTTP des commandes du répertoire des
identités et confirmer que le fichier privé ne transite pas dans leur corps.

## Fichiers à examiner

- `api/identity/admin/imports/index.ts`
- `api/identity/admin/imports/[id]/confirm.ts`
- `api/identity/admin/imports/[id]/approve.ts`
- `api/identity/admin/imports/[id]/activate.ts`
- `api/identity/admin/imports/[id]/retire.ts`
- `api/identity/admin/lookups/index.ts`
- `scripts/test-identity-directory-request-body-bounds.mjs`

## Questions

1. Un payload géant peut-il atteindre une commande d'identité ?
2. La confirmation lit-elle un corps dont elle n'a pas besoin ?
3. Le fichier reste-t-il envoyé directement au stockage privé signé ?
4. Les contrôles de rôle, périmètre et MFA sont-ils conservés ?

## État d'exécution

Audit non lancé : le modèle Claude exact et le plafond de jetons propres à cette
mission n'ont pas été fournis. Aucun jeton externe n'a été consommé.
