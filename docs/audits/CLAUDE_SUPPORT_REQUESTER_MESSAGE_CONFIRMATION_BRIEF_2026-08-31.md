# Audit Claude préparé - message demandeur confirmé

## Autorisation proposée

- Modèle : Claude Sonnet via Claude Code 2.1.251.
- Mission : rechercher une faille concrète dans la reprise idempotente et la
  preuve de persistance des messages de suivi publics.
- Périmètre : diff du lot N5ZV et cinq fichiers maximum.
- Permissions : lecture seule, aucun outil d'écriture, aucun déploiement.
- Consommation estimée : faible.
- Sortie maximale : 80 lignes.
- Arrêt : une exécution, aucune relance et aucun sous-agent.

## Fichiers autorisés

- `api/support/requests/[code]/messages.ts`
- `shared/support-requester-message-confirmation.ts`
- `src/pages/prototype/LyceeConnectPrototype.tsx`
- `scripts/test-support-requester-message-confirmation.mjs`
- `specs/002-agent-etablissement-adaptatif/tasks.md`

## Points à contrôler

1. Une perte de réponse réseau ne peut pas créer un second message.
2. Une clé rejouée avec un autre texte est refusée.
3. Le reçu provient de la trace du message exact.
4. Un reçu falsifié ou discordant ne vide pas l'éditeur.
5. Aucun contenu personnel n'est ajouté au reçu ou aux journaux techniques.

## État

Préparé, non exécuté tant que le lancement borné n'est pas explicitement validé.
