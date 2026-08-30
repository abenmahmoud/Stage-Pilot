# Contrat de délivrabilité Brevo - 30 août 2026

## Sources officielles

- https://developers.brevo.com/docs/transactional-webhooks
- https://developers.brevo.com/docs/how-to-use-webhooks
- https://developers.brevo.com/docs/secured-webhooks
- https://developers.brevo.com/reference/create-webhook

Brevo documente notamment `message-id`, `event` et `ts_epoch` en millisecondes
UTC, ainsi que l'authentification Bearer configurable sur le webhook.

## Contrat local

Le lot n'ouvre aucune route. Il transforme seulement un événement fournisseur
fictif et déjà authentifié en reçu minimal :

- `delivered` devient livré ;
- `deferred` et `soft_bounce` deviennent différé ;
- `hard_bounce`, `blocked`, `invalid` et `error` deviennent rejeté ;
- `spam` et `unsubscribed` conservent leur état dédié ;
- ouverture, clic, requête et simple envoi sont refusés.

L'identifiant du message sortant utilise le même HMAC cloisonné que le
rattachement des réponses. Une autre HMAC, construite avec le message, l'état et
l'horodatage, sert de clé stable de rejeu. Les événements antérieurs à trente
jours ou futurs de plus de cinq minutes sont refusés.

Le reçu ne contient ni adresse, ni objet, ni motif, ni IP, ni tag. Le vérificateur
Bearer commun exige un secret de 32 à 512 caractères et compare uniquement les
empreintes SHA-256 en temps constant.

## Preuves et limites

Cinq tests couvrent la minimisation de sortie, les cinq états, la stabilité des
clés de rejeu, les bornes temporelles et l'authentification. Les six tests du
contrat Brevo entrant passent encore après la mutualisation du Bearer.

T019 reste ouvert jusqu'à la route privée, l'écriture idempotente et la recette
de rejeu. Aucun webhook, secret, email, donnée réelle ou environnement de
production n'a été configuré.
