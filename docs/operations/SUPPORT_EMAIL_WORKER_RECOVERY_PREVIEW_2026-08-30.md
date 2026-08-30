# Reprise du worker email de support

## Contrôles avant envoi

- charge de file JSON limitée à 4 096 caractères ;
- établissement obligatoire et identique à l’établissement configuré ;
- UUID valides pour le travail, la demande, le message et le contact éventuel ;
- seulement quatre types de notification connus ;
- message toujours requis, contact et jeton temporaire requis pour le demandeur ;
- jeton temporaire borné au format base64url.

Un message invalide est archivé dans PGMQ avant toute lecture métier ou tout
appel Brevo. L’archive conserve la possibilité d’un diagnostic technique sans
tenter un envoi dangereux.

## Reprise

Les tentatives 1 à 4 restent dans la file après inscription d’un échec. Au
cinquième échec, le travail rejoint la file d’échec administrable et le message
PGMQ est archivé. Un succès déjà inscrit est acquitté sans nouvel envoi.

Le `job_id` validé est transmis à Brevo comme clé d’idempotence ; une réponse de
doublon du fournisseur est traitée comme une réussite.

## Limite

Les tests sont déterministes et utilisent un faux fournisseur. Ils ne remplacent
pas une interruption contrôlée du worker sur une preview isolée ni la mesure du
p95 de 200 créations HTTP.
