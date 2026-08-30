# Brief d'audit Claude - reprise humaine persistée

## Statut

Préparé le 30 août 2026. Audit non exécuté : le modèle Claude exact et le plafond
de consommation propres à cette mission n'ont pas été confirmés.

## Périmètre strict

- `api/_shared/communication-job-manual-retry-persistence.ts`
- `shared/communication-job-manual-retry.ts`
- tests de reprise manuelle associés

## Mission proposée

Auditer en lecture seule rôle, MFA, confirmation, immutabilité de l'original,
idempotence du successeur et unicité de l'audit. Chercher un double clic, une
reprise d'état terminal ou une création sans validation nominative.

Ne modifier ni exécuter aucun travail, fichier, secret, base, email ou
déploiement.

## Sortie attendue

- constats classés par gravité avec fichier et ligne ;
- correctif minimal et test de non-régression proposé ;
- mention explicite si aucun défaut bloquant n'est trouvé.
