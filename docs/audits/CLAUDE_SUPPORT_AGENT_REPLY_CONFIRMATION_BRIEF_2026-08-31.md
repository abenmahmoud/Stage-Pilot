# Audit externe limité - confirmation d'une réponse agent

Statut : préparé, non exécuté.

## Mission proposée

- Modèle : Claude Sonnet.
- Mode : lecture seule, un seul passage, aucun outil et aucun sous-agent.
- Périmètre : le diff du lot N5ZU uniquement.
- Limite : réponse de 80 lignes maximum, sans relance automatique.

## Points à vérifier

1. Un succès neuf provient de l'événement écrit dans la transaction.
2. Un rejeu retrouve seulement le même texte, les mêmes pièces et la même trace.
3. La clé reste stable après une réponse réseau perdue mais change avec le brouillon.
4. L'interface relit le message exact avant de vider l'éditeur.
5. Le reçu ne contient aucun texte, contact, pièce, jeton ou chemin privé.

## Fichiers du lot

- `shared/support-agent-reply-confirmation.ts`
- `api/support/agent/requests/[code]/reply.ts`
- `src/pages/prototype/LyceeConnectPrototype.tsx`
- `scripts/test-support-agent-reply-confirmation.mjs`
- `package.json`

## Résultat attendu

Classer seulement les risques reproduisibles par sévérité, avec fichier et ligne.
Signaler explicitement l'absence de défaut bloquant. Chaque constat devra être
reproduit localement avant correction.
