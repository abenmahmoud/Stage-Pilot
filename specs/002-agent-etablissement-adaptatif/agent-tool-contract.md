# Contrat des outils contrôlés de l'agent

## Portée actuelle

Ce contrat prépare l'autorisation des futurs outils de l'agent. Aucun connecteur
ENT, PRONOTE, Webmail, SMS ou donnée scolaire n'est activé par ce lot. Les outils
déclarés dans une compétence restent indisponibles tant qu'un adaptateur serveur
n'utilise pas explicitement ce contrat.

## Autorisation obligatoire

Avant toute exécution, le serveur vérifie dans cet ordre :

1. niveau d'action demandé et blocage absolu de `A4` ;
2. clé et état de l'outil ;
3. compétence publiée et présence exacte de l'outil dans sa liste blanche ;
4. établissement de l'acteur, de la compétence et de l'outil ;
5. niveau d'identité `I0-I4` ;
6. rôle, service, relation et MFA séparément ;
7. schéma d'entrée fermé, sans propriété inconnue ;
8. empreinte SHA-256 recalculée côté serveur depuis l'entrée assainie ;
9. pour `A3`, approbation indépendante, non expirée et non consommée.

Une approbation `A3` est liée à l'identifiant de l'action, à la clé d'outil et à
l'empreinte de l'entrée. Elle ne peut donc pas être réutilisée pour une autre
opération. Un administrateur ne contourne aucun de ces contrôles.

L'heure utilisée par la politique vient exclusivement de l'horloge serveur. Le
navigateur ne fournit jamais `now`, `requested_at`, `decided_at`, `consumed_at`
ou `confirmed_at`. Les entrées et leur empreinte sont calculées par le même
adaptateur serveur ; une empreinte envoyée par le client n'est jamais fiable.

## Persistance A3

Les tables privées `agent_actions`, `agent_approvals` et
`agent_action_audit` sont installées dans la preview. `anon` et `authenticated`
n'ont aucun droit direct. Le rôle serveur ne peut pas supprimer une action, une
validation ou un audit.

La fonction serveur `agent_consume_approval` verrouille d'abord l'action puis la
validation dans une seule transaction. Elle vérifie l'établissement, l'outil,
l'empreinte, le demandeur, l'approbateur indépendant, le rôle, l'expiration et
l'absence de consommation. Elle marque ensuite la validation consommée avant de
passer l'action à `running`. Un second appel avec la même validation échoue.

La fonction `agent_decide_approval` applique le même ordre de verrouillage. Le
rôle du valideur et ses services viennent de son compte et de son adhésion
persistée, jamais du navigateur. Elle bloque l'auto-validation, les décisions
interservices, les rôles incompatibles et les validations trop anciennes. Un
refus exige un motif et ferme l'action ; l'approbation laisse l'action en attente
jusqu'à sa consommation par un adaptateur autorisé.

La fonction `agent_expire_approvals` ferme automatiquement, à l'ouverture de la
boîte, les validations périmées du seul établissement et des seuls services du
valideur. Elle verrouille toujours l'action avant la validation, marque l'action
refusée et écrit un audit système sans inventer d'auteur humain. Seul le rôle
serveur peut exécuter cette maintenance.

L'API de la boîte n'expose ni entrée brute, ni identifiant des agents, ni clé
d'outil. Elle transforme uniquement quelques champs masqués et explicitement
autorisés en libellés utiles au contrôle humain.

## Résultat et réussite

Un résultat d'outil contient l'identifiant d'action, la clé exacte, un état, une
date `confirmed_at` et une référence opaque. La réussite n'est exploitable que si :

- l'action et l'outil correspondent à la demande autorisée ;
- l'état est `succeeded` ;
- `confirmed_at` est compris entre la demande et l'heure serveur courante ;
- la référence de confirmation est présente et bornée.

Cette vérification constitue le socle de T028. T028 reste ouverte jusqu'à ce
qu'un outil réel persiste atomiquement son résultat et que l'interface n'affiche
la réussite qu'après lecture de cette preuve.

Le premier adaptateur `support.create_request` est désormais implémenté derrière
`SUPPORT_AGENT_CREATE_REQUEST_ACTION_ENABLED=false`. Le reçu HMAC de préparation
lie l'appareil, l'établissement et la version active d'une compétence publiée
qui autorise exactement l'outil. L'entrée persistée dans le registre est limitée
à la catégorie, au routage, au type de demandeur, au canal et à quatre indicateurs
booléens ; elle exclut noms, coordonnées, objet, description, conversation et
pièces. Le passage de l'action à `running`, la création ou la reprise idempotente
du dossier et la preuve `confirmed_at` sont écrits dans la même transaction.

Cette implémentation ne vaut pas activation opérationnelle. T028 reste ouverte
jusqu'à une recette DB de preview avec compétence fictive, activation bornée du
drapeau, vérification des refus et nettoyage contrôlé.

## Preuve automatisée

`npm run test:agent-tool-policy` couvre la liste blanche, les schémas fermés,
l'établissement, l'identité, le rôle, le service, la relation, le MFA,
l'approbation A3, le rejeu d'approbation, le blocage A4 et les fausses
confirmations.

`npm run test:agent-action-persistence` vérifie les privilèges, RLS, contraintes,
transitions, verrous, audit et confirmation. Une recette transactionnelle sur la
preview a également exécuté puis annulé un flux A3 fictif complet.

`npm run test:support-create-request-action` vérifie la liaison du reçu à
l'appareil et à la compétence publiée, la minimisation de l'entrée, la
transaction action-dossier, l'idempotence et le refus d'un faux succès côté
navigateur.

`npm run test:agent-approval-inbox` vérifie le schéma fermé de décision, les
rôles dérivés, le service immuable, le MFA, les verrous, l'expiration, la sortie
minimale, l'audit système, les privilèges SQL et le comportement responsive de
l'interface.
