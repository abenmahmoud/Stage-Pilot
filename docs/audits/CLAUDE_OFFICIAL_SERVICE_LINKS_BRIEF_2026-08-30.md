# Brief d'audit Claude - accès aux services officiels

## Mission proposée

Auditer uniquement les cartes LyceeGest, Stages, Grand Oral, ENT, PRONOTE et
Scolarité Services. Vérifier qu'aucune donnée métier n'est dupliquée, qu'aucune
adresse PRONOTE n'est inventée, que les libellés ne promettent pas un service
non confirmé et que les liens externes sont isolés correctement.

## Fichiers à examiner

- `src/pages/prototype/LyceeConnectPrototype.tsx`
- `scripts/test-official-service-links.mjs`
- `specs/002-agent-etablissement-adaptatif/tasks.md`

## Sortie attendue

Constats classés par gravité, destination fautive exacte, ambiguïtés de texte et
verdict limité à la preview. Ne demander aucun identifiant ou accès réel.

## État d'exécution

Non exécuté. Le modèle Claude exact et le plafond de jetons propres à cette
mission n'ont pas été fournis ; aucun jeton externe n'a été consommé.
