# Brief d'audit Claude - matrice de couverture WordPress

## Mission proposée

Auditer uniquement le lot qui ajoute la matrice de couverture des 28 contenus
WordPress, son test automatisé et les mises à jour Spec Kit. Rechercher surtout
les faux positifs de couverture, les anciennes URL oubliées, les médias masqués
et toute formulation qui ferait croire à une validation éditoriale ou à une
publication.

## Fichiers à examiner

- `content/legacy-site/coverage-baseline.md`
- `scripts/test-legacy-coverage-baseline.mjs`
- `content/legacy-site/inventory.json`
- `vercel.json`
- `specs/004-reprise-site-officiel/tasks.md`
- `specs/ANALYZE_2026-08-30.md`
- `specs/project-memory.md`

## Sortie attendue

Constats classés par gravité avec fichier et ligne, puis risques résiduels et
tests manquants. Ne proposer aucune opération de production.

## État d'exécution

Non exécuté. Le modèle Claude exact et le plafond de jetons propres à cette
mission n'ont pas été fournis ; aucun jeton externe n'a été consommé.
