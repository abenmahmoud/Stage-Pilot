# Brief d'audit Claude - confirmations des actions publiques

## Mission préparée

Auditer les accusés serveur exigés avant succès local pour un fichier, un message
de suivi et une fermeture de session.

## Fichiers à examiner

- `src/pages/prototype/LyceeConnectPrototype.tsx`
- `api/support/attachments/[id]/confirm.ts`
- `api/support/requests/[code]/messages.ts`
- `api/support/session.ts`
- `scripts/test-support-public-mutation-payloads.mjs`

## Questions

1. Un accusé vide peut-il encore produire un succès visible ?
2. L'identifiant de fichier est-il lié à la réservation correspondante ?
3. Le brouillon du message reste-t-il présent après un accusé invalide ?
4. La mémoire locale reste-t-elle intacte si la révocation n'est pas confirmée ?

## État d'exécution

Audit non lancé : le modèle Claude exact et le plafond de jetons propres à cette
mission n'ont pas été fournis. Aucun jeton externe n'a été consommé.
