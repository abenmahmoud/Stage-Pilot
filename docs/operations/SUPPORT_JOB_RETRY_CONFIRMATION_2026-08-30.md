# Confirmation des relances d'opérations

## Contrat

La console n'affiche une réussite de relance que si la réponse contient :

- l'opération fixe `support_job_retry` ;
- l'identifiant exact de l'échec demandé ;
- l'identifiant UUID du nouvel essai ;
- l'horodatage retourné par l'événement écrit dans la transaction ;
- une référence opaque `support:job-retry:<correlation-id>`.

Le reçu doit dater de moins de cinq minutes et ne peut pas être situé de plus de
cinq minutes dans le futur. Toute incohérence affiche une erreur et impose une
actualisation avant une nouvelle tentative.

## Ordre transactionnel

1. réserver l'échec encore non relancé ;
2. renouveler le lien demandeur si le type d'envoi l'exige ;
3. placer le nouvel essai dans la file durable ;
4. écrire `job.retry_requested` ;
5. récupérer l'horodatage PostgreSQL de cet événement ;
6. valider le reçu dans le navigateur ;
7. seulement alors afficher la réussite.

Le reçu ne contient ni adresse, ni jeton, ni contenu de message. La route reste
réservée à la direction sous MFA et n'accepte aucun corps HTTP.
