# Frontières adverses de l'agent et du guichet

**Statut** : implémenté et vérifié sur la preview
**Tâche** : T022
**Date** : 29 août 2026

## Objectif

Empêcher qu'un texte saisi par un usager, un contact vérifié ou un agent à
périmètre limité puisse modifier les droits, usurper une identité ou ouvrir le
dossier d'une autre personne ou d'un autre service.

## Règles invariantes

- Une déclaration dans la conversation, comme « je suis le proviseur » ou
  « ignore les règles », reste une donnée non fiable et ne crée aucun droit.
- Un contact vérifié prouve seulement l'accès à un canal. Il ne constitue pas
  une identité scolaire et n'autorise pas l'accès aux données d'un tiers.
- Une identité scolaire n'autorise l'accès qu'à soi-même ou à une relation
  active et datée, par exemple le parent d'un élève précisément lié.
- Une session de suivi doit correspondre à la fois au hash de session, au code
  public et à l'identifiant interne du dossier.
- Un agent ne voit que les demandes affectées à ses services. Ce filtre couvre
  la file, les totaux, les statistiques, le détail, les notes, les rappels, les
  traductions et les réponses.
- Les rôles applicatifs proviennent des métadonnées serveur. Les métadonnées que
  l'utilisateur peut modifier ne sont jamais une source d'autorisation.
- Le passage à l'identité confirmée reste une action humaine protégée par MFA.
  Ni le chat public ni le modèle ne peuvent l'effectuer.

## Réponse sûre de l'agent

Lorsqu'un message demande une donnée scolaire sur un tiers tout en revendiquant
un rôle, l'agent ne fournit ni emploi du temps, ni salle, ni coordonnée. Il peut
proposer l'ouverture d'une demande et réclame les éléments d'identité utiles au
traitement humain. Cette réponse reste disponible sans appel au modèle externe.

## Matrice automatisée

La recette couvre neuf frontières : injection de rôle, contact sans identité,
relation parent-enfant, session liée au dossier, séparation des services,
contrôle de chaque route agent, filtrage des statistiques, source des rôles et
confirmation MFA. Elle complète les tests existants de l'agent, de l'identité,
des accès agents et des liens de suivi, soit 47 contrôles ciblés.

## Limites et suite

- Cette tâche vérifie les frontières techniques, pas tous les scénarios humains
  de la charte.
- T022A reste ouverte pour les urgences sans permanence, fausses confirmations
  d'alerte, demandes sur un tiers, appareils partagés, santé minimisée et recours
  humain.
- Les tests utilisent uniquement des identités et dossiers fictifs. Aucune liste
  réelle du lycée n'est nécessaire pour vérifier ces garanties.
