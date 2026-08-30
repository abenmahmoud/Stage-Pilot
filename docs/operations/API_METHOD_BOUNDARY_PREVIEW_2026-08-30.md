# Frontière des méthodes API - preview du 30 août 2026

## Contrôle

Le test `test-api-method-boundary-coverage.mjs` parcourt récursivement les routes
Vercel, en excluant les modules internes `_shared`. Pour chaque handler public,
il exige :

- une lecture explicite de `req.method` ;
- l'utilisation de la réponse `methodNotAllowed` partagée ;
- l'import de cette réponse depuis le module commun.

Les 94 routes présentes passent ce contrôle. Une nouvelle route sans frontière
de méthode fera désormais échouer la barrière de sécurité de la preview.

## Portée

Le lot est statique et local. Il n'appelle aucune route, ne modifie aucune base
et n'envoie aucune donnée. Les contrôles d'autorisation, de rôle et de MFA
restent testés séparément dans la même barrière.
