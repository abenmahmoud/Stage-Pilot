# Brief d'audit Claude - recette Webmail preview

## Statut

Préparé le 30 août 2026. Audit non exécuté : le modèle Claude exact et le plafond
de consommation propres à cette mission n'ont pas été confirmés.

## Mission proposée

Auditer en lecture seule la recette SQL de 200 livraisons fictives et son test
local. Vérifier transaction, `ROLLBACK`, résidus, cloisonnement établissement,
idempotence, immutabilité, cohérence des quatre répartitions et absence de
coordonnées ou d'identifiants fournisseur bruts.

Ne lancer aucune migration, requête distante, diffusion, webhook ou
modification. Ne lire aucun secret et ne toucher à aucun environnement réel.

## Sortie attendue

- constats classés par gravité avec fichier et ligne ;
- correctif minimal et test de non-régression proposé ;
- mention explicite si aucun défaut bloquant n'est trouvé.
