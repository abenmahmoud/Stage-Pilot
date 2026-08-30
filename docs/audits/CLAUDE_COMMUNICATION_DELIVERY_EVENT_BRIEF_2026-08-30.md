# Brief d'audit Claude - délivrabilité Brevo

## Statut

Préparé le 30 août 2026. Audit non exécuté : le modèle Claude exact et le plafond
de consommation propres à cette mission n'ont pas été confirmés.

## Périmètre strict

- `shared/communication-webhook-auth.ts`
- `shared/communication-brevo-inbound.ts`
- `shared/communication-delivery-event.ts`
- `scripts/test-communication-brevo-inbound.mjs`
- `scripts/test-communication-delivery-event.mjs`
- `docs/operations/COMMUNICATION_DELIVERY_EVENT_CONTRACT_2026-08-30.md`

## Mission proposée

Auditer en lecture seule T019A : comparaison Bearer, variantes documentées des
événements, unité et fenêtre de `ts_epoch`, rapprochement avec la HMAC sortante,
collision ou instabilité de la clé de rejeu, fuite d'adresse/objet/motif/IP/tag
et acceptation involontaire des événements de suivi. Examiner aussi si un
événement répété peut produire une action multiple lors de la future
persistance.

Ne modifier aucun fichier, navigateur, secret, environnement ou déploiement et
ne créer aucun webhook.

## Sortie attendue

- constats classés par gravité avec fichier et ligne ;
- correctif minimal et test de non-régression proposé ;
- mention explicite si aucun défaut bloquant n'est trouvé.
