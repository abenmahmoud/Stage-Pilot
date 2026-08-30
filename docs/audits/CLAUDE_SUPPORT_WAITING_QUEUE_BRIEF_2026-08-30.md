# Brief d'audit Claude - file en attente usager

## Mission proposée

Auditer uniquement l'onglet `En attente` de la console agent. Vérifier que le
statut serveur exact est utilisé, que les périmètres restent appliqués, qu'aucun
rappel ou changement de statut n'est implicite et que l'ajout ne provoque pas de
débordement à 320 px.

## Fichiers à examiner

- `src/pages/prototype/LyceeConnectPrototype.tsx`
- `api/support/agent/requests/index.ts`
- `src/pages/prototype/lycee-connect.css`
- `scripts/test-support-waiting-queue.mjs`

## Sortie attendue

Constats classés par gravité avec fichier et ligne, fuite de périmètre, action
implicite, régression responsive et verdict limité à la preview.

## État d'exécution

Non exécuté. Le modèle Claude exact et le plafond de jetons propres à cette
mission n'ont pas été fournis ; aucun jeton externe n'a été consommé.
