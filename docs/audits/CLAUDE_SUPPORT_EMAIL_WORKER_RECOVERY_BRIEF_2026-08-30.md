# Brief Claude - reprise du worker email

## Statut

Brief préparé, non exécuté. Le modèle Claude exact et le plafond de consommation
doivent être autorisés pour cette mission précise. Aucun jeton externe n’a été
consommé.

## Mission proposée

Auditer en lecture seule la validation, l’idempotence et la reprise du worker de
notifications du guichet. Chercher un travail de file pouvant traverser un autre
établissement, déclencher un envoi avant validation, être perdu après une panne
ou produire un doublon évitable.

## Périmètre minimal

- `shared/support-email-job-policy.ts` ;
- `shared/support-job-retry.ts` ;
- `api/cron/support-worker.ts` ;
- `api/_shared/brevo.ts` ;
- `scripts/test-support-email-job-policy.mjs` ;
- `scripts/test-support-resilience.mjs` ;
- diff Git du lot.

Aucun accès Vercel, Supabase, Brevo, `.env`, donnée réelle ou outil d’écriture.

## Questions

1. Un message mal formé ou hors établissement peut-il atteindre `deliver` ?
2. Les quatre reprises puis l’isolement au cinquième sont-ils sans suppression ?
3. Une panne après l’envoi peut-elle changer la clé d’idempotence au rejeu ?
4. Les archives et files d’échec évitent-elles d’exposer le jeton temporaire ?

## Arrêt

Une seule passe, rapport court par sévérité avec fichier, preuve et correction
minimale. Aucune relance ni extension de périmètre.
