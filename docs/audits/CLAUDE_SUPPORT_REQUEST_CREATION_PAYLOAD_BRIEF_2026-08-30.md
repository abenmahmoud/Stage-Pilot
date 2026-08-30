# Brief d'audit Claude - confirmation navigateur de création

## Mission préparée

Auditer la validation du paquet renvoyé au navigateur après création d'une
demande et avant tout effet local ou dépôt de pièce jointe.

## Fichiers à examiner

- `src/pages/prototype/LyceeConnectPrototype.tsx`
- `api/support/requests/index.ts`
- `shared/support-request-confirmation.ts`
- `scripts/test-support-request-creation-payload.mjs`

## Questions

1. Une réponse partielle peut-elle afficher ou mémoriser un faux dossier ?
2. La preuve est-elle liée au même numéro et à des dates cohérentes ?
3. Une réponse d'erreur serveur conserve-t-elle un message usager borné ?
4. Les pièces jointes restent-elles bloquées tant que la création n'est pas
   confirmée ?

## État d'exécution

Audit non lancé : le modèle Claude exact et le plafond de jetons propres à cette
mission n'ont pas été fournis. Aucun jeton externe n'a été consommé.
