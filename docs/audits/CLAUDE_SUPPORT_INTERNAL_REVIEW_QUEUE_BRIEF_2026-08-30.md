# Brief d'audit Claude - file de vérification interne

## Mission proposée

Auditer uniquement le filtre `À vérifier` et son compteur. Vérifier le statut
exact, le cloisonnement établissement/service, l'absence d'action implicite et
le comportement responsive de la barre de filtres.

## Fichiers à examiner

- `api/support/agent/requests/index.ts`
- `src/pages/prototype/LyceeConnectPrototype.tsx`
- `scripts/test-support-internal-review-queue.mjs`

## Sortie attendue

Constats classés par gravité avec fichier et ligne, fuite de périmètre, action
implicite, régression responsive et verdict limité à la preview.

## État d'exécution

Non exécuté. Le modèle Claude exact et le plafond de jetons propres à cette
mission n'ont pas été fournis ; aucun jeton externe n'a été consommé.
