# Brief d'audit Claude - file sans agent

## Mission proposée

Auditer uniquement la file `Sans agent`. Vérifier que `assignedTo is null` est
appliqué après le périmètre serveur, qu'elle reste distincte de l'absence de
service et qu'aucune attribution automatique n'est introduite.

## Fichiers à examiner

- `api/support/agent/requests/index.ts`
- `src/pages/prototype/LyceeConnectPrototype.tsx`
- `scripts/test-support-unassigned-queue.mjs`

## Sortie attendue

Constats classés par gravité avec fichier et ligne, fuite interservice,
confusion service/agent, action implicite et régression responsive.

## État d'exécution

Non exécuté. Le modèle Claude exact et le plafond de jetons propres à cette
mission n'ont pas été fournis ; aucun jeton externe n'a été consommé.
