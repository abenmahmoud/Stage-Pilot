# Persistance des événements de livraison - 30 août 2026

## Objectif

T019B prépare la réception durable des événements Brevo sans activer le webhook.
La route est fermée par défaut, authentifiée par Bearer et rattachée uniquement
à l'établissement configuré côté serveur.

## Idempotence et confidentialité

- le `message-id` fournisseur devient un HMAC avant toute recherche ;
- l'événement possède un second HMAC unique par établissement ;
- un rejeu conserve une seule trace et ne réécrit pas la livraison ;
- la base ne stocke ni adresse, ni objet, ni motif fournisseur, ni IP, ni tag ;
- la réponse du webhook expose seulement accepté, rattaché, doublon et appliqué.

## Ordre des états

Un état `delivered` ne régresse pas vers `deferred` ou `rejected`. Les signaux
`spam` et `unsubscribed` peuvent toutefois le remplacer car ils concernent
l'abus et le consentement. `unsubscribed` et `cancelled` sont terminaux. Chaque
événement reconnu reste audité, même lorsqu'il est trop ancien pour modifier
l'état courant.

## Activation encore interdite

La migration ajoute l'empreinte unique et l'état `spam`, mais elle n'a pas été
appliquée à distance. Les variables
`COMMUNICATION_DELIVERY_WEBHOOK_ENABLED`,
`COMMUNICATION_DELIVERY_WEBHOOK_TOKEN` et
`COMMUNICATION_PROVIDER_MESSAGE_HMAC_SECRET` ne sont définies dans aucun
environnement par ce lot. T019 reste ouvert jusqu'à une migration prouvée et
une recette de rejeu entièrement fictive sur la preview.
