# Brief d'audit Claude - persistance des destinataires

## Statut

Préparé le 30 août 2026. Audit non exécuté : le modèle Claude exact et le plafond
de consommation propres à cette mission n'ont pas été confirmés.

## Mission proposée

Auditer en lecture seule la persistance d'une résolution signée. Vérifier le
verrou, l'établissement, la version courante validée, l'idempotence, la
relecture après conflit, les projections SQL, l'audit agrégé et l'absence de
coordonnées.

Ne modifier aucun fichier et ne lancer aucune base, route, résolution Webmail,
diffusion, secret ou déploiement.

## Sortie attendue

- constats classés par gravité avec fichier et ligne ;
- correctif minimal et test de non-régression proposé ;
- mention explicite si aucun défaut bloquant n'est trouvé.
