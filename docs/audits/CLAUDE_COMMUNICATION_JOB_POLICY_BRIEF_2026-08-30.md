# Brief d'audit Claude - politique des travaux de communication

## Statut

Préparé le 30 août 2026. Audit non exécuté : le modèle Claude exact et le plafond
de consommation propres à cette mission n'ont pas été confirmés.

## Périmètre strict

- `shared/communication-job-policy.ts`
- `scripts/test-communication-job-policy.mjs`
- schéma `communication_jobs` et `communication_deliveries`
- `docs/operations/COMMUNICATION_JOB_FAILURE_POLICY_2026-08-30.md`
- T020A dans `specs/005-centre-communications/tasks.md`

## Mission proposée

Auditer en lecture seule les transitions de panne et d'annulation : plafonds,
délais, code permanent ou temporaire, borne SQL à 20, entrée en boîte d'échec,
course avec un worker `running`, compensation de livraison et impossibilité de
rappeler un email envoyé. Chercher aussi toute entrée permettant de conserver
un texte fournisseur ou une donnée personnelle dans `last_error_code`.

Ne modifier aucun fichier, base, secret, environnement, travail ou déploiement.

## Sortie attendue

- constats classés par gravité avec fichier et ligne ;
- correctif minimal et test de non-régression proposé ;
- mention explicite si aucun défaut bloquant n'est trouvé.
