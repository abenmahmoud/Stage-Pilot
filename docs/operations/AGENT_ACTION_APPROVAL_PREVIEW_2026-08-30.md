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
- Chaque action possède un service immuable qui détermine sa boîte de validation.
- L'approbateur doit être distinct, dans le rôle attendu et décider avant
  expiration.
- L'API exige MFA et une adhésion active persistée ; le navigateur ne fournit ni
  rôle, ni service, ni utilisateur, ni horloge de décision.
- La boîte `/admin/validations-agent` ne reçoit que des libellés et champs
  masqués autorisés. Elle n'expose pas l'entrée brute ni les identifiants agents.
- À son ouverture, `agent_expire_approvals` ferme uniquement les validations
  périmées de l'établissement et des services autorisés. L'action devient
  refusée et l'audit porte le rôle `system`, sans faux auteur humain.
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

Une seconde recette a validé la boîte de décision : approbation, refus motivé,
fermeture de l'action refusée, blocage interservice, blocage de l'auto-validation
et immutabilité du service. Les trois tables contenaient zéro ligne avant la
recette et aucune donnée de test n'a été conservée après `ROLLBACK`.

La migration d'expiration a ensuite été appliquée à la preview vide. Un appel
sans périmètre a confirmé un résultat nul ; `anon` et `authenticated` ne peuvent
pas exécuter la fonction, contrairement au seul `service_role`. Les 57 contrôles
ciblés, le build et `npm audit --omit=dev --audit-level=high` passent.

Une troisième recette transactionnelle a expiré une validation fictive, vérifié
le refus de l'action et l'audit `system`, puis exécuté `ROLLBACK` avec les trois
tables à zéro. La transition SQL autorise aussi l'expiration d'une approbation
déjà accordée mais non consommée ; elle refuse une expiration avant l'échéance
et ne rouvre jamais une approbation consommée.

Le conseiller performance ne signale plus aucune clé étrangère non indexée pour
ces tables. Les seuls avis restants sur ce lot sont des index encore inutilisés,
ce qui est normal tant que les tables de preview restent vides.

## Suite

Le premier adaptateur réel devra être autorisé séparément, recalculer l'empreinte,
consommer la validation et n'afficher une réussite qu'après persistance de la
confirmation externe. Les notifications de nouvelle validation seront ajoutées
avec cet adaptateur afin de ne pas créer aujourd'hui un canal sans action réelle.
