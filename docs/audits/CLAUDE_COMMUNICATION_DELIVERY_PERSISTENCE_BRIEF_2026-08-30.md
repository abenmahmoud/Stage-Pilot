# Brief d'audit Claude - persistance des livraisons

## Statut

Préparé le 30 août 2026. Audit non exécuté : le modèle Claude exact et le plafond
de consommation propres à cette mission n'ont pas été confirmés.

## Périmètre strict

- `shared/communication-delivery-event.ts`
- `shared/communication-delivery-transition.ts`
- `api/webhooks/brevo/communications-delivery.ts`
- `supabase/migrations/20260830090000_add_communication_delivery_event_dedupe.sql`
- `scripts/test-communication-delivery-persistence.mjs`

## Mission proposée

Auditer en lecture seule l'authentification, le cloisonnement établissement,
l'idempotence, le verrou de ligne, les événements hors ordre et les réponses du
webhook. Chercher une fuite de coordonnées, un double traitement, une régression
de `delivered` et toute activation involontaire du webhook.

Ne modifier aucun fichier, secret, environnement, travail, base ou déploiement.

## Sortie attendue

- constats classés par gravité avec fichier et ligne ;
- correctif minimal et test de non-régression proposé ;
- mention explicite si aucun défaut bloquant n'est trouvé.
