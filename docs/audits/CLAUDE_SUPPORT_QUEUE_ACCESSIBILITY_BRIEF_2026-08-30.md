# Brief d'audit Claude - accessibilité des filtres agent

## Mission proposée

Auditer uniquement le nom accessible, l'état sélectionné et le comportement
clavier des neuf filtres de la file de demandes. Vérifier qu'aucun rôle ARIA
incomplet ou modèle d'onglets partiel n'est introduit.

## Fichiers à examiner

- `src/pages/prototype/LyceeConnectPrototype.tsx`
- `scripts/test-support-queue-accessibility.mjs`

## Sortie attendue

Constats classés par gravité avec fichier et ligne, annonce ambiguë, état faux,
ordre clavier ou contrôle inaccessible.

## État d'exécution

Non exécuté. Le modèle Claude exact et le plafond de jetons propres à cette
mission n'ont pas été fournis ; aucun jeton externe n'a été consommé.
