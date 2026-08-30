# Brief d'audit Claude - reçu signé du Webmail

## Statut

Préparé le 30 août 2026. Audit non exécuté : le modèle Claude exact et le plafond
de consommation propres à cette mission n'ont pas été confirmés.

## Périmètre strict

- `shared/communication-webmail-delivery.ts`
- `shared/communication-webmail-receipt.ts`
- `scripts/test-communication-webmail-receipt.mjs`
- T018A, T018B, T027B et T027C

## Mission proposée

Auditer en lecture seule la liaison commande/reçu, la séparation des clés,
l'expiration, la comparaison temporellement sûre, l'idempotence et la
minimisation. Chercher tout moyen de substituer une livraison, une commande, un
établissement ou un identifiant fournisseur, puis tout risque de double envoi.

Ne modifier aucun fichier, secret, environnement, contact, email ou
déploiement.

## Sortie attendue

- constats classés par gravité avec fichier et ligne ;
- correctif minimal et test de non-régression proposé ;
- mention explicite si aucun défaut bloquant n'est trouvé.
