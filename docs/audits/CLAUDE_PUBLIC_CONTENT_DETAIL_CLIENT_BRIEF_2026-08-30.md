# Brief d'audit Claude - page éditoriale dédiée

## Mission préparée

Auditer le contrat navigateur partagé par les flux éditoriaux et la page
`/site/:slug`, en particulier la liaison entre l'adresse demandée et l'article
rendu.

## Fichiers à examiner

- `src/pages/prototype/public-content-client.ts`
- `src/pages/prototype/PublicContentPage.tsx`
- `src/pages/prototype/LyceeConnectPrototype.tsx`
- `api/content/public.ts`
- `scripts/test-public-content-client-payload.mjs`

## Questions

1. Un article lié à un autre slug peut-il être rendu ?
2. Plusieurs articles ou un curseur peuvent-ils être acceptés par la route
   dédiée ?
3. Une URL externe ou non signée peut-elle déclencher un chargement navigateur ?
4. Les trois consommateurs publics appliquent-ils bien le même contrat ?

## État d'exécution

Audit non lancé : le modèle Claude exact et le plafond de jetons propres à cette
mission n'ont pas été fournis. Aucun jeton externe n'a été consommé.
