# Brief Claude - payload du tableau de santé

## Statut

Audit externe non exécuté. Zéro jeton externe consommé.

## Mission préparée

Relire `shared/support-operations-payload.ts`, son branchement dans
`SupportOperationsPage.tsx` et `test-support-operations-payload.mjs`. Chercher
une donnée non bornée, un contournement du schéma exact, une cohérence métier
incorrecte, une indisponibilité provoquée par une réponse serveur pourtant
valide ou une action de relance offerte à un type de travail non pris en charge.

## Périmètre et arrêt

Revue en lecture seule de ces fichiers et des deux routes API productrices,
sans accès à Vercel, Supabase, aux variables ou à des données réelles. Arrêter
après les constats classés par sévérité et les tests manquants. Le modèle Claude
exact et le plafond de jetons ne sont pas fixés ; la mission ne doit donc pas
être lancée.
