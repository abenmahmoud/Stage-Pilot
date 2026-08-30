# Brief d'audit Claude - autorisation du centre de communications

## Statut

Préparé le 30 août 2026. Audit non exécuté : le modèle Claude exact et la limite
de consommation propres à cette mission n'ont pas été confirmés.

## Périmètre strict

- `api/_shared/communications.ts`
- les sept routes sous `api/communications/admin/`
- `scripts/test-communication-authorization.mjs`
- `api/_shared/auth.ts`
- `api/_shared/support-agent-access.ts`

## Mission proposée

Auditer en lecture seule la chaîne authentification, MFA `aal2`, rôle, adhésion,
établissement et interrupteurs du centre privé. Chercher un contournement entre
routes, un rôle trop large, une lecture inter-établissement, une route sans
garde ou une action d'audience, publication ou envoi ouverte par erreur. Ne
modifier aucun fichier, environnement ou déploiement et ne manipuler aucune
donnée réelle.

## Sortie attendue

- constats classés par sévérité avec fichier et ligne ;
- scénario minimal de reproduction ;
- mention explicite si aucun défaut bloquant n'est trouvé ;
- risques résiduels séparés des défauts confirmés.
