# Couverture RLS du guichet - preview du 30 août 2026

## Objectif

Imposer la sécurité par ligne aux tables privées du guichet, y compris lorsqu'une
requête est exécutée avec le rôle propriétaire. Les API serveur restent le seul
passage applicatif prévu ; les rôles publics, anonymes et authentifiés ne
reçoivent aucun droit direct sur ces tables.

## Lot préparé

- la migration `20260830150000_force_support_private_rls.sql` couvre les seize
  tables `support_*` présentes dans l'historique des migrations ;
- la migration échoue si une table attendue manque, active puis force la RLS et
  retire les droits directs à `public`, `anon` et `authenticated` ;
- le test `test-support-rls-coverage.mjs` découvre les tables depuis toutes les
  migrations et échoue si une nouvelle table privée n'est pas ajoutée à la
  couverture.

## Limites

La migration n'est appliquée à aucune base par ce lot. Son exécution sur la
preview exigera une autorisation distincte, une sauvegarde vérifiée et une
recette des API serveur. T011 reste ouverte pour le test RLS et la création
concurrente contre la base de preview.
