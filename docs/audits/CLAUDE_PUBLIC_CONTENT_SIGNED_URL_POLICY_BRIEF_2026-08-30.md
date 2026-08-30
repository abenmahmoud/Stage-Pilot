# Brief d'audit Claude - URL signées des médias publics

## Mission préparée

Auditer en lecture seule la validation des URL signées du bucket éditorial privé,
sans accès à Supabase, aux médias réels ou à la production.

## Fichiers à examiner

- `shared/public-content-signed-url.ts`
- `src/pages/prototype/public-content-client.ts`
- `src/components/PublicContentMarkdown.tsx`
- `api/_shared/site-content.ts`
- `api/content/admin/legacy-import.ts`
- `scripts/test-public-content-client-payload.mjs`

## Questions

1. Une URL d'une autre origine, avec identifiants ou en HTTP peut-elle passer ?
2. Un chemin encodé, incomplet ou hors des deux formats produits peut-il passer ?
3. Un second jeton, un paramètre parasite, un fragment ou un jeton vide passe-t-il ?
4. Les médias modernes et historiques légitimes restent-ils compatibles ?

## État d'exécution

Audit non lancé : le modèle Claude exact et le plafond de jetons propres à cette
mission n'ont pas été fournis. Aucun jeton externe n'a été consommé.
