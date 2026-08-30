# Brief d'audit Claude - remise à zéro des filtres

## Mission proposée

Auditer uniquement l'action de remise à zéro de la file agent. Vérifier qu'elle
réinitialise tous les états attendus, reste accessible au clavier et ne provoque
ni requête incohérente ni débordement à 320 px.

## Fichiers à examiner

- `src/pages/prototype/LyceeConnectPrototype.tsx`
- `src/pages/prototype/lycee-connect.css`
- `scripts/test-support-queue-reset.mjs`

## Sortie attendue

Constats classés par gravité avec fichier et ligne, état oublié, requête de
course, contrôle inaccessible ou régression responsive.

## État d'exécution

Non exécuté. Le modèle Claude exact et le plafond de jetons propres à cette
mission n'ont pas été fournis ; aucun jeton externe n'a été consommé.
