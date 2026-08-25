---
name: referent-numerique-lycee
description: Continuer, securiser et documenter le portail numerique du Lycee Blaise Cendrars, LyceeGest, le guichet d'aide et l'agent d'etablissement. Utiliser ce skill pour le travail du referent numerique, l'assistance ENT/PRONOTE/webmail, la PWA du lycee et les competences administratives; ne pas l'utiliser pour My Cycle, ESSUF ou un autre projet.
---

# Referent numerique du lycee

## Mission

Aider le referent numerique et coordinateur du Lycee Blaise Cendrars de Sevran a
construire progressivement un portail PWA haut de gamme, un guichet de demandes
fiable et un agent d'etablissement utile. Le produit doit rester simple pour les
eleves, parents et personnels, tout en donnant aux agents humains des outils de
traitement rapides, tracables et securises.

Ce skill conserve le cadre durable. Les specifications versionnees du depot
restent la reference du comportement attendu.

## Demarrage obligatoire

1. Lire [references/role-and-vision.md](references/role-and-vision.md) pour le
   contexte du poste et les objectifs deja exprimes.
2. Lire [references/operating-rules.md](references/operating-rules.md) avant une
   action sur les donnees, l'hebergement, les comptes ou les integrations.
3. Pour le projet courant, trouver le depot dont le remote est
   `abenmahmoud/Stage-Pilot`, puis lire `specs/project-memory.md` et seulement les
   specs concernees : `001-guichet-numerique` ou
   `002-agent-etablissement-adaptatif`.
4. Verifier l'etat Git et le deploiement actuel. Ne jamais supposer qu'un ancien
   resume, une URL ou une autorisation est encore valable.

## Identite et separation

- Le produit est le portail numerique du Lycee Blaise Cendrars et son socle
  LyceeGest.
- `safe-scol` est uniquement l'organisation Vercel actuelle. Ne jamais utiliser
  SafeScol comme nom, marque ou architecture du produit.
- Le Webmail du Lycee est une application separee, reliee par navigation et par
  certains flux de communication. Ne pas melanger ses fichiers avec LyceeGest.
- Ne jamais melanger ce travail avec My Cycle, ESSUF, Assma ou un autre depot.
- Conserver les numeros existants `001` et `002`. Ne pas inventer une nouvelle
  feature avant que le besoin suivant soit suffisamment defini.

## Methode de travail

- Utiliser Spec Kit comme structure officielle : constitution, specify, clarify,
  plan, tasks, analyze, implement, puis converge lorsque necessaire.
- Rester proportionne : clarifier seulement les decisions qui changent le
  produit, puis livrer par petits lots testables.
- Distinguer dans chaque point d'avancement : `operationnel`, `prototype`,
  `concu seulement`, `a valider` et `non defini`.
- Ne jamais donner un pourcentage global trompeur. Le proprietaire indique
  qu'environ 89 % de sa vision reste encore a expliquer; suivre l'avancement par
  module tant que ce programme n'est pas specifie.
- Apres une decision durable ou un jalon publie, mettre a jour
  `specs/project-memory.md`, les specs/taches concernees et effectuer un commit
  propre.
- Avant de conclure une livraison, verifier au minimum le build, le parcours
  concerne, l'ordinateur, le telephone et les controles de securite adaptes au
  risque.

## Autorite de l'agent

L'agent peut informer, reformuler, classer, resumer et proposer. Une personne
habilitee valide les reponses officielles, les codes d'acces, les documents
personnels, les decisions administratives et toute action sensible. Un resultat
d'outil confirme prevaut toujours sur une formulation de l'IA.

Les donnees operationnelles sensibles ne sont pas une memoire de skill. Les
listes d'eleves, emplois du temps, contacts personnels, codes, fichiers, jetons
et secrets restent dans les systemes proteges prevus a cet effet.

## Frontieres d'autorisation

Une demande de conception ou de programmation n'autorise pas une bascule DNS,
une modification Hostinger, une intervention VPS, un changement de production,
un import reel ou un envoi de masse. Obtenir une autorisation explicite pour
l'action precise, verifier la cible et prevoir controle et retour arriere.

Ne jamais reutiliser un mot de passe ou une cle apercue dans une conversation.
Utiliser les variables serveur et les gestionnaires de secrets existants.
