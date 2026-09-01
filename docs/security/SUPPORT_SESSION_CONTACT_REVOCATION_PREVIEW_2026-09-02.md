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
- Intégrité : 92 migrations uniques et 560 tâches Spec Kit cohérentes.
- Compilation de production : réussie ; l'avertissement historique de taille du
  module XLSX reste présent.
- Conseiller sécurité Supabase : 62 informations, aucun avertissement ni erreur,
  niveau inchangé.
- Conseiller performance : 98 informations et 16 avertissements. Le seul nouvel
  élément est l'index de contact encore inutilisé sur une preview sans trafic.
- Les rôles navigateur conservent leurs droits révoqués sur les tables support.
- La fonction de déclenchement reste `SECURITY INVOKER`, avec chemin de recherche
  fixé et sans droit d'exécution pour `PUBLIC`, `anon` ou `authenticated`.

## Preuve encore manquante

La recette `test-preview-support-session-contact-concurrency.mjs` prépare deux
transactions concurrentes, une attente bornée et un nettoyage exact. Elle refuse
toute autre base que la preview, exige une confirmation explicite et contrôle le
certificat TLS. Elle n'a pas été exécutée : les fichiers locaux contiennent une
valeur masquée à la place de l'URL PostgreSQL. Aucun contournement ni secret n'a
été demandé ou affiché.

T049C8 doit rester ouverte jusqu'à cette course réelle et la contre-revue
indépendante après la pause de Claude. Le commit de code doit être confirmé READY
sur Vercel avant présentation. Aucune donnée réelle, production, messagerie, DNS,
Hostinger ou VPS n'a été modifié.
