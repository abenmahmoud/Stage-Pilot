# Brief d'audit Claude - persistance Webmail

## Statut

Préparé le 30 août 2026. Audit non exécuté : le modèle Claude exact et le plafond
de consommation propres à cette mission n'ont pas été confirmés.

## Périmètre strict

- `api/_shared/communication-webmail-persistence.ts`
- `shared/communication-webmail-completion.ts`
- migration de poignée de main Webmail
- `scripts/test-communication-webmail-persistence.mjs`

## Mission proposée

Auditer en lecture seule la transaction, les verrous, le cloisonnement, les
conditions d'écriture, l'idempotence de l'événement et le comportement en cas de
conflit. Chercher une mise à jour partielle, un verrou insuffisant, une course ou
une fuite de HMAC dans la réponse.

Ne modifier ni appliquer aucun fichier, secret, environnement, contact, email,
migration ou déploiement.

## Sortie attendue

- constats classés par gravité avec fichier et ligne ;
- correctif minimal et test de non-régression proposé ;
- mention explicite si aucun défaut bloquant n'est trouvé.
