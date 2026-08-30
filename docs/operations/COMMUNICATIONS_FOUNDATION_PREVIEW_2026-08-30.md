# Fondation privée du centre de communications

## Portée

Le stockage de `005-centre-communications` est installé uniquement sur la branche
Supabase de preview `xijocumlwivhbmffrnlj`. Le module, la publication et l'envoi
restent désactivés. Aucun contact, contenu ou message réel n'a été créé.

## Garanties vérifiées

- huit tables privées, toutes cloisonnées par `institution_id` ;
- RLS activée et forcée, zéro lecture directe `anon` ou `authenticated` ;
- aucune colonne d'adresse destinataire ; audiences et contacts sont des
  références opaques qui refusent `@` ;
- versions immuables après validation et audit append-only ;
- file durable avec reprise, état, compteur et clé d'idempotence ;
- publication et envoi bloqués dans la base tant que leurs interrupteurs sont
  absents ou faux ;
- livraison et travail opérationnel refusés sans version validée ;
- audiences figées après validation ; identité des livraisons et travaux
  immuable après insertion ;
- toutes les clés étrangères du module possèdent un index couvrant dans le bon
  ordre.

## Recette fictive

`supabase/tests/communication_foundation_security.test.sql` crée dans une
transaction un utilisateur, deux établissements, une communication, une version,
une audience, une livraison, des travaux et un événement entièrement fictifs.
Elle prouve les refus de fuite, croisement, doublon, contournement d'interrupteur,
modification après validation et altération de l'audit, puis exécute `ROLLBACK`.

Résultat du 30 août 2026 : zéro résidu utilisateur, établissement, communication
ou travail.

## Limites assumées

- aucune route API ni interface n'utilise encore ces tables ;
- aucun groupe Webmail réel n'est connu ;
- les mentions, durées et rôles finaux attendent la validation du lycée ;
- aucun worker, Brevo, email entrant ou publication n'est activé.

L'avertissement Supabase `rls_enabled_no_policy` est informatif et attendu pour
des tables privées sans accès client. La recette confirme les privilèges nuls.
