# Brief d'audit Claude - pages publiques du lycée

## Mission préparée

Auditer que tous les consommateurs publics du flux éditorial appliquent le même
contrat navigateur avant rendu.

## Fichiers à examiner

- `src/pages/prototype/LyceeConnectPrototype.tsx`
- `scripts/test-public-content-client-payload.mjs`

## Questions

1. « À la une » et « Vie du lycée » utilisent-ils le même validateur ?
2. Un paquet refusé peut-il être rendu par un autre chemin de l'interface ?
3. Le repli statique reste-t-il visible et sans accès à l'origine injectée ?

## État d'exécution

Audit non lancé : le modèle Claude exact et le plafond de jetons propres à cette
mission n'ont pas été fournis. Aucun jeton externe n'a été consommé.
