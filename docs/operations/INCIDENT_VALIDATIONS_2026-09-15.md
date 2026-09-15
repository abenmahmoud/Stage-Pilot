# Erreur serveur de la page Validations — 15 septembre 2026

## Constat confirmé

La capture d’Adel concerne `/admin/validations-agent`, onglet Historique. Les réponses proposées dans Demandes et les classements à confirmer sont des fonctionnalités différentes : les vérifications précédentes portaient sur la mauvaise page.

Reproduction dans la console connectée : « Erreur serveur ». Les journaux du déploiement `923ebd5` montrent un HTTP 500 dans `GET /api/support/agent/approvals`, PostgreSQL `42846` : `cannot cast type record to text[]`.

Drizzle développait la liste JavaScript des services en tuple `($2, $3, …)::text[]`, au lieu d’un tableau PostgreSQL. La même construction figurait dans l’API de décision.

## Correction

Les deux appels SQL utilisent désormais `ARRAY[...]::text[]`, avec chaque service lié comme paramètre. Le cas sans service produit un tableau vide typé. Les contrôles d’authentification, d’habilitation, d’établissement, de rôle, d’expiration et d’indépendance de la décision sont conservés ; aucune permission, validation réelle ou donnée de demande n’est modifiée par le correctif.

## Preuves

- Build TypeScript/Vite réussi.
- 18 tests de boîte de validation et de contrats réussis, dont deux régressions compilant les véritables requêtes des endpoints pour zéro, un ou plusieurs services et une chaîne contenant des caractères SQL. Les services restent des paramètres ; le périmètre restreint ne devient pas global.
- Base PostgreSQL jetable PGlite : l’ancienne requête reproduit `42846` sur les deux routes ; les 16 exécutions corrigées réussissent, avec tableaux vides, simples, multiples et caractères spéciaux, pour les deux valeurs du drapeau de périmètre. Les fonctions de cette recette sont des doublures sans effet métier : aucune approbation réelle ni envoi.
- Le contrôle de navigation du test historique a été aligné sur `ManagementNavigation`, où se trouve désormais le lien ; le contrôle n’est pas supprimé.

Recette jetable hors dépôt : `Communication_site_2026-09-14/verify-approval-service-arrays.mjs`. Contrôle publié des trois onglets et du téléphone à compléter après déploiement.

## Publication

Branche existante `codex/lycee-connect-prototype`. Point de retour : `923ebd5`, déploiement `dpl_J5Q9xjYipmgAL1vMiphfpLqWB1Bc`. Aucun changement de DNS, d’environnement ou de schéma.
