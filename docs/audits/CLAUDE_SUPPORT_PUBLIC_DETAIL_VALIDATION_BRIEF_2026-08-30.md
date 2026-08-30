# Brief d'audit Claude - détail public d'une demande

## Mission préparée

Auditer la validation du dossier public, l'isolation de ses erreurs et la
protection contre les réponses arrivées après un changement de sélection.

## Fichiers à examiner

- `src/pages/prototype/LyceeConnectPrototype.tsx`
- `scripts/test-support-public-detail-payload.mjs`
- `api/support/requests/[code].ts`

## Questions

1. Un message, une pièce ou un contexte mal formé peut-il atteindre le rendu ?
2. Une lecture ancienne peut-elle remplacer le dossier actuellement choisi ?
3. Une panne du détail peut-elle effacer la liste ou être confondue avec une autre action ?

## État d'exécution

Audit non lancé : le modèle Claude exact et le plafond de jetons propres à cette
mission n'ont pas été fournis. Aucun jeton externe n'a été consommé.
