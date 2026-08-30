# Brief d'audit Claude - flux public des informations

## Mission préparée

Auditer la validation navigateur des articles et médias publiés avant leur rendu
dans « À la une ».

## Fichiers à examiner

- `src/pages/prototype/LyceeConnectPrototype.tsx`
- `api/content/public.ts`
- `shared/site-content.ts`
- `api/_shared/site-content.ts`
- `scripts/test-public-content-client-payload.mjs`

## Questions

1. Un contenu privé, futur, démesuré ou de type inconnu peut-il être rendu ?
2. Une URL externe ou non signée peut-elle déclencher un chargement navigateur ?
3. Les pages et curseurs sont-ils bornés et exempts de doublons ?
4. Le refus d'un paquet invalide conserve-t-il un état public clair et stable ?

## État d'exécution

Audit non lancé : le modèle Claude exact et le plafond de jetons propres à cette
mission n'ont pas été fournis. Aucun jeton externe n'a été consommé.
