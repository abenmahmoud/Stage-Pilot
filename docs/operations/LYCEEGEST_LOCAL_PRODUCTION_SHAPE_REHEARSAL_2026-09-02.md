# Répétition locale de la forme de production

**Date** : 2 septembre 2026
**Cible** : Supabase local dans Docker uniquement
**Résultat** : réussi

## Objet

Vérifier que le schéma historique réellement appliqué en production peut
atteindre les 93 migrations Git actuelles avec un volume représentatif, sans
utiliser ni modifier une donnée réelle ou un service distant.

Les compteurs de référence proviennent de l'année scolaire précédente. Ils ne
constituent pas l'annuaire 2026-2027 et ne doivent pas devenir une source de
connaissance de l'agent.

## Garde-fous

- Confirmation obligatoire `--local-container-only`.
- Supabase CLI épinglée à `2.116.0` et exécutée par `npx`.
- Toutes les commandes SQL portent `--local`.
- Variables de connexion distante et clés Supabase retirées du sous-processus.
- Aucun identifiant de projet distant dans la recette ou les fixtures.
- Identités, emails, codes, adresses et établissement entièrement fictifs.
- Aucune notification, API distante, production, preview ou Storage appelé.

## Séquence exécutée

1. Reconstruction locale arrêtée à `20260518073508`, soit les 3 migrations
   réellement présentes dans la base de production.
2. Chargement d'une fixture synthétique : 44 classes, 106 professeurs, 1 159
   élèves, 1 159 stages, 2 fiches de grand oral, 2 journaux d'import et 6
   modèles de document.
3. Application locale ordonnée des 90 migrations suivantes.
4. Contrôle des 93 versions finales, des compteurs et de l'absence d'emails
   autres que le domaine réservé `example.test`.

Résultat final émis par la recette :

```json
{"target":"local_synthetic_production_shape","cliVersion":"2.116.0","migrations":93,"classes":44,"staff":106,"students":1159,"placements":1159,"realData":false}
```

## Reproduction

```powershell
npm run test:local-production-shape-migration-safety
npm run recipe:local-production-shape-migration
```

Le premier script contrôle statiquement que la recette reste locale et
synthétique. Le second recrée la base locale et détruit donc uniquement les
données locales de test présentes dans le conteneur LyceeGest.

## Limites et prochaine porte

Ce succès n'est ni une preuve de sauvegarde, ni une restauration de production,
ni une autorisation de promotion. La prochaine preuve obligatoire est une
sauvegarde chiffrée restaurée dans une cible isolée autorisée, suivie de la même
répétition, d'une recette humaine et du test de retour au code public précédent.
