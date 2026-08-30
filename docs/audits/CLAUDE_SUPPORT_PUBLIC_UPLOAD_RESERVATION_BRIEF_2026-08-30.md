# Brief d'audit Claude - réservation publique de pièce jointe

## Mission préparée

Auditer le contrôle navigateur de la réservation signée avant tout appel au
stockage Supabase de quarantaine.

## Fichiers à examiner

- `src/pages/prototype/LyceeConnectPrototype.tsx`
- `api/support/requests/[code]/attachments.ts`
- `scripts/test-support-public-upload-reservation.mjs`

## Questions

1. Un autre bucket ou un chemin injecté peut-il atteindre le client Supabase ?
2. Le chemin est-il lié à l'identifiant de pièce renvoyé par la même réponse ?
3. Un jeton vide, démesuré ou contenant des caractères inattendus est-il refusé ?

## État d'exécution

Audit non lancé : le modèle Claude exact et le plafond de jetons propres à cette
mission n'ont pas été fournis. Aucun jeton externe n'a été consommé.
