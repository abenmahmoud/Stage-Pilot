# Brief d'audit Claude - liste publique des demandes

## Mission préparée

Auditer la validation de la liste publique « Mes demandes » avant affichage,
notification et persistance dans la mémoire privée de l'appareil.

## Fichiers à examiner

- `src/pages/prototype/LyceeConnectPrototype.tsx`
- `src/lib/support-device-memory.ts`
- `scripts/test-support-public-list-payload.mjs`

## Questions

1. Une réponse mal formée peut-elle encore atteindre IndexedDB ou une notification ?
2. Une actualisation ancienne peut-elle remplacer la liste la plus récente ?
3. Les limites et doublons évitent-ils une consommation mémoire non bornée ?

## État d'exécution

Audit non lancé : le modèle Claude exact et le plafond de jetons propres à cette
mission n'ont pas été fournis. Aucun jeton externe n'a été consommé.
