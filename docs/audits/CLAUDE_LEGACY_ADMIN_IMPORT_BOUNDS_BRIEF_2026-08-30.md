# Brief d'audit Claude - ancien import administratif borné

## Mission préparée

Auditer en lecture seule l'import CSV/Excel historique, sans ouvrir de fichier
réel, appeler une base ou exécuter un import.

## Fichiers à examiner

- `shared/legacy-import-input.ts`
- `api/import/eleves.ts`
- `api/import/professeurs.ts`
- `src/pages/admin/ImportPage.tsx`
- `scripts/test-legacy-admin-import-bounds.mjs`

## Questions

1. Plus de 5 000 lignes ou plus de 10 Mo peuvent-ils être lus côté navigateur ?
2. Un corps HTTP supérieur à 5 Mo peut-il atteindre les routes ?
3. Un champ inconnu, démesuré ou contenant des contrôles peut-il être persisté ?
4. Les exports actuels élèves et enseignants restent-ils compatibles ?

## État d'exécution

Audit non lancé : le modèle Claude exact et le plafond de jetons propres à cette
mission n'ont pas été fournis. Aucun jeton externe n'a été consommé.
