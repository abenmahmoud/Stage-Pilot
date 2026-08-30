# Brief d'audit Claude - reprise manuelle des communications

## Statut

Préparé le 30 août 2026. Audit non exécuté : le modèle Claude exact et le plafond
de consommation propres à cette mission n'ont pas été confirmés.

## Périmètre strict

- `shared/communication-job-policy.ts`
- `shared/communication-job-manual-retry.ts`
- `scripts/test-communication-job-manual-retry.mjs`
- schéma `communication_jobs` et `communication_deliveries`
- T020A et T020B dans `specs/005-centre-communications/tasks.md`

## Mission proposée

Auditer en lecture seule les autorisations, la MFA, les courses et les doublons
de reprise humaine. Vérifier qu'un email déjà remis ou un rejet permanent ne
peut pas être renvoyé, que l'échec d'origine reste immuable et que la clé HMAC
ne fuit ni identifiant ni secret. Chercher aussi toute voie permettant de
réinjecter du texte fournisseur ou une donnée personnelle.

Ne modifier aucun fichier, secret, environnement, travail, base ou déploiement.

## Sortie attendue

- constats classés par gravité avec fichier et ligne ;
- correctif minimal et test de non-régression proposé ;
- mention explicite si aucun défaut bloquant n'est trouvé.
