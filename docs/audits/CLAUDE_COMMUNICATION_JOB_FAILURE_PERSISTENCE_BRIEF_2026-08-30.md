# Brief d'audit Claude - persistance des pannes

## Statut

Préparé le 30 août 2026. Audit non exécuté : le modèle Claude exact et le plafond
de consommation propres à cette mission n'ont pas été confirmés.

## Périmètre strict

- `api/_shared/communication-job-failure.ts`
- `shared/communication-job-policy.ts`
- tests de panne et de persistance associés

## Mission proposée

Auditer en lecture seule le verrou, le compteur d'essais, la programmation, le
passage à `dead`, la non-régression des livraisons et la minimisation de l'audit.
Chercher une reprise infinie, une perte d'échec ou une mise à jour partielle.

Ne modifier ni exécuter aucun travail, fichier, secret, base, email ou
déploiement.

## Sortie attendue

- constats classés par gravité avec fichier et ligne ;
- correctif minimal et test de non-régression proposé ;
- mention explicite si aucun défaut bloquant n'est trouvé.
