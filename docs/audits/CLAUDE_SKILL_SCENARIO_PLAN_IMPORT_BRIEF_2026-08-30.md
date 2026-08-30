# Brief Claude - import local d’une matrice de scénarios

## Statut

Brief préparé, non exécuté. Le modèle Claude exact et le plafond de consommation
doivent être autorisés pour cette mission précise. Aucun jeton externe n’a été
consommé.

## Mission proposée

Auditer en lecture seule l’import Markdown utilisé pour préparer les preuves de
test. Chercher tout moyen d’envoyer le fichier au serveur, de contourner les
bornes, d’injecter un secret, de prévalider un résultat ou de confondre import et
exécution réelle.

## Périmètre minimal

- `shared/skill-scenario-plan.ts` ;
- `src/pages/admin/KnowledgeRegistryPage.tsx` ;
- `scripts/test-skill-scenario-plan.mjs` ;
- diff Git du lot.

Aucun accès Vercel, Supabase, `.env`, donnée réelle ou outil d’écriture.

## Questions

1. Le fichier ou la matrice peuvent-ils quitter le navigateur pendant l’import ?
2. Les minima, doublons, préfixes, tailles et secrets sont-ils tous refusés ?
3. Un scénario préparé peut-il devenir réussi ou confirmé automatiquement ?
4. L’interface reste-t-elle utilisable sur mobile avec des textes longs ?

## Arrêt

Une seule passe, rapport court par sévérité avec fichier, preuve et correction
minimale. Aucune relance ni extension de périmètre.
