# Révocation des accès de suivi liés au contact

**Date** : 2 septembre 2026
**Périmètre** : branche Git et Supabase de preview uniquement
**Tâche** : `002/T049C8`, encore ouverte

## Objectif

Empêcher une adresse email supprimée ou désactivée de conserver un accès déjà
ouvert à un dossier. Une adresse simplement déclarée ne doit pas devenir une
preuve d'identité.

## Comportement obtenu

- La session créée avec une première demande reste sans contact vérifié.
- Une session ouverte par lien ou code conserve l'identifiant du contact email
  support exact qui a fourni la preuve.
- Chaque lecture publique revérifie que ce contact existe encore, appartient au
  même dossier, utilise le canal email et l'usage support, et n'est pas désactivé.
- La désactivation révoque les sessions liées et consomme les jetons ouverts.
- La suppression effectue la même révocation avant la suppression du contact.
- Les sessions historiques ouvertes de la preview ont été révoquées lors de la
  migration, car leur contact d'origine ne pouvait pas être déduit sûrement.

## Base de préproduction

La branche a été revérifiée avant le scénario :

- projet parent : `sfqhxiamhgsbbogluqtq` ;
- branche : `guichet-lycee-preview` ;
- référence : `xijocumlwivhbmffrnlj` ;
- branche non principale, `with_data=false`, état sain.

La migration `20260901223342_bind_support_sessions_to_contacts.sql` est installée
uniquement sur cette branche. Un scénario installé a créé un dossier fictif, deux
contacts `example.invalid`, deux sessions liées, une session ordinaire et deux
jetons. Il a prouvé les révocations séparées lors d'une désactivation puis d'une
suppression. Le nettoyage final retourne `remaining_fixture_rows=0`.

## Contrôles

- 92 scénarios existants de lien, code, récupération et notification : réussis.
- 7 scénarios de provenance, lecture, migration et sûreté de recette : réussis.
- 10 scénarios de quota assistant, dont le contact lié actif ou désactivé : réussis.
- Barrière de sécurité transversale : réussie.
- Intégrité actuelle : 93 migrations uniques et 562 tâches Spec Kit cohérentes.
- Compilation de production : réussie ; l'avertissement historique de taille du
  module XLSX reste présent.
- Conseiller sécurité Supabase : 63 informations, aucun avertissement ni erreur ;
  l'information ajoutée ensuite vient de la table serveur du garde budgétaire IA.
- Conseiller performance : 98 informations et 16 avertissements. Le seul nouvel
  élément est l'index de contact encore inutilisé sur une preview sans trafic.
- Les rôles navigateur conservent leurs droits révoqués sur les tables support.
- La fonction de déclenchement reste `SECURITY INVOKER`, avec chemin de recherche
  fixé et sans droit d'exécution pour `PUBLIC`, `anon` ou `authenticated`.

## Preuve concurrente

La recette `test-preview-support-session-contact-concurrency.mjs` prépare deux
transactions concurrentes, une attente bornée et un nettoyage exact. Elle refuse
toute autre base que la preview, exige une confirmation explicite et contrôle le
certificat TLS. L'URL locale restant masquée, le même scénario a été exécuté par
deux connexions SQL distinctes et simultanées du connecteur Supabase, uniquement
sur `xijocumlwivhbmffrnlj`, avec des UUID fixes et une adresse
`example.invalid` :

- les deux transactions de désactivation aboutissent ;
- la seconde attend la libération du verrou du contact ;
- la session liée est révoquée et le jeton lié est consommé ;
- les quatre lignes fictives sont supprimées par le scénario ;
- une requête indépendante confirme ensuite `remaining_fixture_rows=0`.

Aucun secret n'a été demandé ou affiché. Le commit de code `17813120` est READY
sur une preview Vercel protégée ; la production est restée inchangée.

T049C8 reste ouverte uniquement pour la contre-revue indépendante après la pause
de Claude. Aucune donnée réelle, production, messagerie, DNS, Hostinger ou VPS
n'a été modifié.
