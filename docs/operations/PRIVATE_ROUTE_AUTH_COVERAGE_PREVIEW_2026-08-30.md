# Couverture d'accès des routes privées - preview du 30 août 2026

## Contrôle

Le test `test-private-route-auth-coverage.mjs` inventorie les routes sous les
sept espaces privés : administration, contenus, identités, connaissances,
emplois du temps, communications et espace agent.

Les 65 routes présentes appellent toutes une fonction `require...` avec la
requête avant de poursuivre leur traitement. Les helpers spécialisés conservent
la responsabilité du rôle, de l'établissement, du service et de la MFA.

## Portée

Ce contrôle évite une omission d'authentification lors de l'ajout d'une route.
Il complète, sans les remplacer, les tests comportementaux des helpers, des
périmètres d'établissement et des rôles. Aucun compte ou service distant n'est
appelé.
