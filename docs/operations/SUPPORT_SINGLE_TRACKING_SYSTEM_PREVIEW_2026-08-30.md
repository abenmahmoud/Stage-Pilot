# Guichet unique de suivi - preview

## Invariant livré

- Le chat et le formulaire classique appellent la même création idempotente.
- L'assistant ne crée pas de dossier et ne stocke pas une seconde conversation.
- Le suivi usager et les consoles agents lisent les mêmes entités du guichet
  `001` : demandes, messages, pièces, événements et notifications.
- Les compétences et sources de l'agent enrichissent le traitement sans devenir
  un système parallèle.

## Vérification

- `npm run test:support-single-tracking` contrôle le parcours UI, les routes
  publiques, les routes agents et le modèle de données.
- Les contrôles existants de création, accès, concurrence, conversations,
  pièces et routage restent indépendants et réutilisables.
- Aucune migration, donnée réelle, envoi ou activation distante n'est requis.

## Conséquence opérationnelle

Une personne conserve un seul numéro de demande et chaque service travaille sur
le même historique. Une évolution future qui introduirait une boîte propre à
l'assistant ou un stockage parallèle fera échouer le test de contrat.
