# Brief Claude - preuves d’évaluation des compétences

## Statut

Brief préparé, non exécuté. Le modèle Claude exact et le plafond de consommation
doivent être autorisés pour cette mission précise.

## Mission proposée

Auditer en lecture seule la séparation entre définition d’une compétence,
exécution des scénarios et publication. Chercher un moyen de publier avec des
résultats déclarés, anciens, futurs, incomplets, non prouvés ou enregistrés hors
du bon établissement.

## Périmètre minimal

- `shared/knowledge-registry-input.ts` ;
- `shared/skill-registry-policy.ts` ;
- `api/knowledge/admin/versions/[id]/action.ts` ;
- `api/knowledge/admin/versions/[id]/evaluations.ts` ;
- `src/pages/admin/KnowledgeRegistryPage.tsx` ;
- tests du registre et diff Git du lot.

Aucun accès Vercel, Supabase, `.env`, donnée réelle ou outil d’écriture.

## Questions

1. Un brouillon peut-il encore produire une évaluation qui compte ?
2. Une exécution antérieure au gel ou datée dans le futur peut-elle passer ?
3. Les minima 5/3/3, les preuves et les secrets sont-ils contrôlés côté serveur ?
4. La route impose-t-elle direction, MFA et établissement avant toute écriture ?

## Arrêt

Une seule passe, rapport court par sévérité avec fichier, preuve et correction
minimale. Aucune relance ni extension de périmètre.
