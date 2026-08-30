# Brief d'audit Claude - relectures du détail agent

## Mission préparée

Vérifier qu'aucune action de la console agent ne peut remplacer un détail valide
par une réponse API partielle ou mal typée.

## Fichiers à examiner

- `src/pages/prototype/LyceeConnectPrototype.tsx`
- `scripts/test-support-detail-payload-validation.mjs`

## Questions

1. Toutes les lectures du détail utilisent-elles le même validateur ?
2. Une erreur de relecture conserve-t-elle un état compréhensible et récupérable ?
3. Une réponse partielle peut-elle atteindre `setDetail` par un autre chemin ?

## État d'exécution

Audit non lancé : le modèle Claude exact et le plafond de jetons propres à cette
mission n'ont pas été fournis. Aucun jeton externe n'a été consommé.
