# Actions et validations A3 en preview

## Portée

Ce lot installe uniquement le coffre persistant des futures actions contrôlées.
Il n'active aucun outil ENT, PRONOTE, Webmail, SMS, email ou système scolaire.

## Garanties

- `agent_actions`, `agent_approvals` et `agent_action_audit` sont privées avec
  RLS activée et forcée.
- `anon` et `authenticated` n'ont aucun accès direct.
- `service_role` peut lire, créer et mettre à jour les actions et validations,
  mais ne peut les supprimer. L'audit ne peut pas être modifié ou supprimé.
- `A4` ne peut pas être inséré.
- Une action `A3` commence en attente et exige un compte demandeur nominatif.
- L'approbateur doit être distinct, dans le rôle attendu et décider avant
  expiration.
- La fonction `agent_consume_approval` verrouille l'action puis la validation,
  vérifie toutes les liaisons et consomme la validation avant `running`.
- `succeeded` exige une preuve d'outil, une référence opaque et `confirmed_at`.

## Recette exécutée

Une transaction sur `guichet-lycee-preview` a créé deux comptes et un
établissement fictifs, une compétence, une action `A3` et une validation. Elle a
ensuite :

1. enregistré l'approbation par un autre compte ;
2. consommé la validation et démarré l'action ;
3. vérifié cinq événements d'audit ;
4. refusé la seconde consommation de la même validation ;
5. exécuté `ROLLBACK`.

Les trois tables contenaient zéro ligne avant la recette et aucune donnée de test
n'a été conservée.

Le conseiller performance ne signale plus aucune clé étrangère non indexée pour
ces tables. Les seuls avis restants sur ce lot sont des index encore inutilisés,
ce qui est normal tant que les tables de preview restent vides.

## Suite

La boîte de validation, ses API et ses notifications restent à construire. Le
premier adaptateur réel devra être autorisé séparément, recalculer l'empreinte et
n'afficher une réussite qu'après persistance de la confirmation externe.
