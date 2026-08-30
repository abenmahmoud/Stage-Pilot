# Couverture RLS du guichet - preview du 30 août 2026

## Objectif

Imposer la sécurité par ligne aux tables privées du guichet, y compris lorsqu'une
requête est exécutée avec le rôle propriétaire. Les API serveur restent le seul
passage applicatif prévu ; les rôles publics, anonymes et authentifiés ne
reçoivent aucun droit direct sur ces tables.

## Lot appliqué et vérifié

- la migration `20260830150000_force_support_private_rls.sql` couvre les seize
  tables `support_*` présentes dans l'historique des migrations ;
- la migration échoue si une table attendue manque, active puis force la RLS et
  retire les droits directs à `public`, `anon` et `authenticated` ;
- le test `test-support-rls-coverage.mjs` découvre les tables depuis toutes les
  migrations et échoue si une nouvelle table privée n'est pas ajoutée à la
  couverture.

La migration a été appliquée le 30 août 2026 uniquement sur la branche Supabase
de preview `xijocumlwivhbmffrnlj`. Une lecture des catalogues Postgres confirme
pour les seize tables `support_*` :

- `relrowsecurity = true` ;
- `relforcerowsecurity = true` ;
- aucun droit de lecture ou mutation pour `anon` et `authenticated`.

Le conseiller Supabase ne remonte aucun avertissement ni erreur de sécurité. Les
informations `RLS enabled no policy` sont attendues pour ces tables serveur
privées, car leur absence de politique est précisément le refus par défaut.

## Preuve de concurrence

La recette `T011-20260830a` a ouvert vingt transactions simultanées de dix
demandes fictives chacune. Elle a obtenu exactement 200 dossiers, 200 clés
uniques, 200 messages, 200 contacts `example.invalid`, 200 sessions, 200
liaisons et 200 travaux dans une file PGMQ isolée.

Une seconde course de vingt transactions utilisant toutes la même clé a produit
un seul dossier, un seul message, un seul contact, une seule session et un seul
travail. La file temporaire et toutes les lignes de recette ont ensuite été
supprimées ; les trois compteurs de résidus sont revenus à zéro.

Le script répétable `scripts/load-test-support.mjs` reproduit désormais les deux
preuves, refuse toute cible non confirmée comme preview et borne sa concurrence.
Cette recette ne mesure pas la latence HTTP du portail et n'envoie aucun email.
