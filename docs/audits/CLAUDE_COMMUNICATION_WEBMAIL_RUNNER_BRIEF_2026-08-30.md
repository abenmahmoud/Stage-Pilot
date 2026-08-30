# Brief d'audit Claude - runner Webmail

## Statut

Préparé le 30 août 2026. Audit non exécuté : le modèle Claude exact et le plafond
de consommation propres à cette mission n'ont pas été confirmés.

## Mission proposée

Auditer en lecture seule le client d'échange et le runner Webmail. Chercher un
appel avant validation du lot, un dépassement de concurrence, une confusion
d'établissement ou de livraison, une fuite de contenu dans les résultats, une
double persistance et une nouvelle tentative immédiate après acceptation suivie
d'une panne de base.

Ne modifier aucun fichier, ne lancer aucun transport, email, webhook, secret,
base ou déploiement.

## Sortie attendue

- constats classés par gravité avec fichier et ligne ;
- correctif minimal et test de non-régression proposé ;
- mention explicite si aucun défaut bloquant n'est trouvé.
