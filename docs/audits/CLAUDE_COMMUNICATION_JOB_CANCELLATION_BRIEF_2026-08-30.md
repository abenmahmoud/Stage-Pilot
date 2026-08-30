# Brief d'audit Claude - annulation des communications

## Statut

Préparé le 30 août 2026. Audit non exécuté : le modèle Claude exact et le plafond
de consommation propres à cette mission n'ont pas été confirmés.

## Mission proposée

Auditer en lecture seule la politique, la migration, la persistance et la route
d'annulation. Vérifier MFA, rôles, confirmation, verrouillage, courses, arrêt
d'urgence sous interrupteurs coupés, refus d'un travail `running` et absence de
fausse promesse de rappel pour tout état fournisseur.

Ne modifier ni exécuter aucune migration, base, route, email, secret ou
déploiement.

## Sortie attendue

- constats classés par gravité avec fichier et ligne ;
- correctif minimal et test de non-régression proposé ;
- mention explicite si aucun défaut bloquant n'est trouvé.
