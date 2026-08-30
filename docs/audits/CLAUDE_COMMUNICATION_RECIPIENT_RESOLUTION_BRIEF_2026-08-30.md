# Brief d'audit Claude - résolution opaque des destinataires

## Statut

Préparé le 30 août 2026. Audit non exécuté : le modèle Claude exact et le plafond
de consommation propres à cette mission n'ont pas été confirmés.

## Périmètre strict

- `shared/communication-recipient-registry.ts`
- `shared/communication-recipient-resolution.ts`
- `scripts/test-communication-recipient-resolution.mjs`
- schéma `communication_deliveries`
- T016, T017A et T029A dans `specs/005-centre-communications/tasks.md`

## Mission proposée

Auditer en lecture seule le cloisonnement, la liaison à l'instantané approuvé,
la signature, l'expiration, la pagination, l'éligibilité et l'idempotence de 200
destinataires fictifs. Chercher une fuite de coordonnées, un élargissement de
l'audience, un doublon entre pages et une confusion entre versions.

Ne modifier aucun fichier, secret, environnement, contact, base ou déploiement.

## Sortie attendue

- constats classés par gravité avec fichier et ligne ;
- correctif minimal et test de non-régression proposé ;
- mention explicite si aucun défaut bloquant n'est trouvé.
