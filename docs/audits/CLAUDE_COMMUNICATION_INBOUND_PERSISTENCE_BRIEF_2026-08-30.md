# Brief d'audit Claude - persistance entrante

## Statut

Préparé le 30 août 2026. Audit non exécuté : le modèle Claude exact et le plafond
de consommation propres à cette mission n'ont pas été confirmés.

## Périmètre strict

- `shared/communication-brevo-inbound.ts`
- `shared/communication-inbound-matching.ts`
- `api/webhooks/brevo/communications-inbound.ts`
- tests entrants associés

## Mission proposée

Auditer en lecture seule fermeture, Bearer, HMAC, limites, idempotence,
rattachement par établissement, projections et audit. Chercher une persistance
du corps, une fuite d'adresse, un repli nominatif ou un rattachement croisé.

Ne modifier ni appeler aucun webhook, fichier, secret, base, email ou
déploiement.

## Sortie attendue

- constats classés par gravité avec fichier et ligne ;
- correctif minimal et test de non-régression proposé ;
- mention explicite si aucun défaut bloquant n'est trouvé.
