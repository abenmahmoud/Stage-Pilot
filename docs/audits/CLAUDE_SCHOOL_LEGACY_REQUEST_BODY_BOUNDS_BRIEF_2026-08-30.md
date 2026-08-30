# Brief d'audit Claude - corps des modules historiques

## Mission préparée

Auditer en lecture seule les plafonds HTTP des anciens modules et la suppression
de l'écriture de masse des paramètres établissement.

## Fichiers à examiner

- `shared/etablissement-input.ts`
- `api/etablissement.ts`
- `api/admin/affectations-eleves.ts`
- `api/admin/affectations-classes.ts`
- `api/grand-oral/mine.ts`
- `api/grand-oral/[id]/sign.ts`
- `api/stages/mine.ts`
- `api/stages/[id].ts`
- `api/stages/livret.ts`
- `scripts/test-school-legacy-request-body-bounds.mjs`

## Questions

1. Toutes les mutations historiques ont-elles une limite proportionnée ?
2. Un champ inconnu peut-il encore atteindre le modèle établissement ?
3. Les formats UAI, email, téléphone, année et dates sont-ils validés ?
4. Les contrôles de rôle et d'accès existants restent-ils en place ?

## État d'exécution

Audit non lancé : le modèle Claude exact et le plafond de jetons propres à cette
mission n'ont pas été fournis. Aucun jeton externe n'a été consommé.
