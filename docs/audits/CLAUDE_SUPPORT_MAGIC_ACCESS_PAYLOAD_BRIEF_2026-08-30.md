# Brief d'audit Claude - échange navigateur du lien magique

## Mission préparée

Auditer la validation de la confirmation renvoyée au navigateur après échange
d'un lien magique à usage unique.

## Fichiers à examiner

- `src/pages/prototype/LyceeConnectPrototype.tsx`
- `api/support/access/[token].ts`
- `scripts/test-support-magic-access-payload.mjs`

## Questions

1. Un numéro de dossier inattendu peut-il modifier l'état ou être affiché ?
2. Le jeton est-il retiré de l'URL dans chaque issue observable ?
3. Le changement conserve-t-il la session HttpOnly comme seule preuve d'accès ?

## État d'exécution

Audit non lancé : le modèle Claude exact et le plafond de jetons propres à cette
mission n'ont pas été fournis. Aucun jeton externe n'a été consommé.
