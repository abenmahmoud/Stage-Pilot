# Brief d'audit Claude - prise des travaux Webmail

## Statut

Préparé le 30 août 2026. Audit non exécuté : le modèle Claude exact et le plafond
de consommation propres à cette mission n'ont pas été confirmés.

## Périmètre strict

- `api/_shared/communication-job-claim.ts`
- `scripts/test-communication-job-claim.mjs`
- politique de panne des communications

## Mission proposée

Auditer en lecture seule la CTE de prise, `SKIP LOCKED`, les filtres de périmètre,
le plafond de lots, la récupération des verrous et le calcul des essais. Chercher
une double prise, le vol d'un verrou frais, une famine ou une réanimation après
le plafond.

Ne modifier ni exécuter aucun travail, fichier, secret, base, email ou
déploiement.

## Sortie attendue

- constats classés par gravité avec fichier et ligne ;
- correctif minimal et test de non-régression proposé ;
- mention explicite si aucun défaut bloquant n'est trouvé.
