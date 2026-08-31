# Brief Claude - restauration du coffre d'identités

## Statut

Audit externe non exécuté. Zéro jeton externe consommé.

## Mission préparée

Relire `verifyIdentityVaultRecoverySnapshot`, la recette
`test-identity-vault-recovery.mjs` et la procédure associée. Rechercher une
validation de schéma ou de périmètre insuffisante, une preuve non déterministe,
une fuite de clair, une rotation qui permettrait de retirer une ancienne clé trop
tôt ou un contournement de la limite de lot.

## Périmètre et arrêt

Revue en lecture seule de ces fichiers et de leurs dépendances cryptographiques
directes, avec données fictives et sans accès aux variables, clés, bases ou
services distants. Arrêter après les constats classés par sévérité et les tests
manquants. Le modèle Claude exact et le plafond de jetons ne sont pas encore
fixés ; la mission ne doit donc pas être lancée.
