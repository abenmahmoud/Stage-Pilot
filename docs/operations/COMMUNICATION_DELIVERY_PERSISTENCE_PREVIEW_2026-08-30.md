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

## Preuve sur la preview

La migration additive `20260830090000_add_communication_delivery_event_dedupe`
est appliquée uniquement sur le projet Supabase de preview
`xijocumlwivhbmffrnlj`. La recette
`supabase/tests/communication_delivery_event_security.test.sql` a confirmé :

- un même événement n'est conservé qu'une fois dans un établissement ;
- la même empreinte reste distincte dans un second établissement ;
- le HMAC invalide et l'état fournisseur inconnu sont refusés ;
- `spam` est un état gouverné accepté ;
- `anon` et `authenticated` ne disposent d'aucun accès direct d'écriture ;
- le rollback laisse zéro utilisateur, établissement, communication, livraison
  ou événement fictif.

L'advisor Supabase ne remonte aucun `WARN` ou `ERROR` de sécurité. Il signale
seulement, au niveau `INFO`, que `communication_deliveries` et
`communication_events` ont RLS activé sans politique. C'est intentionnel : ces
tables restent privées côté serveur et la recette confirme l'absence de droits
clients. Référence de l'advisor :
https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy

## Activation encore interdite

Les variables
`COMMUNICATION_DELIVERY_WEBHOOK_ENABLED`,
`COMMUNICATION_DELIVERY_WEBHOOK_TOKEN` et
`COMMUNICATION_PROVIDER_MESSAGE_HMAC_SECRET` ne sont définies dans aucun
environnement par ce lot. Le webhook, Brevo et tout envoi externe restent donc
désactivés. T019 est fermé par la preuve de persistance ; l'activation fournisseur
relèvera d'une décision et d'une recette séparées.
