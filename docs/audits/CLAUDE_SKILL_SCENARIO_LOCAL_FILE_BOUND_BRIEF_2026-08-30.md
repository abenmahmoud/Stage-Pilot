# Brief d'audit Claude - matrice locale bornée

## Mission préparée

Auditer en lecture seule l'import local de la matrice Markdown de tests.

## Fichiers à examiner

- `shared/skill-scenario-plan.ts`
- `src/pages/admin/KnowledgeRegistryPage.tsx`
- `scripts/test-skill-scenario-plan.mjs`

## Questions

1. Un fichier supérieur à 100 Ko peut-il atteindre `file.text()` ?
2. Le contenu peut-il être envoyé au serveur ou à un fournisseur IA ?
3. Les plafonds du parseur restent-ils appliqués après la lecture locale ?

## État d'exécution

Audit non lancé : le modèle Claude exact et le plafond de jetons propres à cette
mission n'ont pas été fournis. Aucun jeton externe n'a été consommé.
