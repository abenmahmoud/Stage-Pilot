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
8. pour `A3`, approbation indépendante, non expirée et non consommée.

Une approbation `A3` est liée à l'identifiant de l'action, à la clé d'outil et à
l'empreinte de l'entrée. Elle ne peut donc pas être réutilisée pour une autre
opération. Un administrateur ne contourne aucun de ces contrôles.

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

## Preuve automatisée

`npm run test:agent-tool-policy` couvre la liste blanche, les schémas fermés,
l'établissement, l'identité, le rôle, le service, la relation, le MFA,
l'approbation A3, le rejeu d'approbation, le blocage A4 et les fausses
confirmations.
