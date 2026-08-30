# Écart du domaine public - constat du 30 août 2026

## Constat

- `https://gestion.lycee-blaise-cendrars-sevran.fr/prototype` répond `200` sans
  compte Vercel ;
- ce domaine pointe vers le déploiement de production
  `dpl_41augagG39fL5gMXcud3WrWiZfQH`, commit `a9cf32e` ;
- `GET /api/content/public?limit=1` y répond `500` avec le message public borné
  `Erreur serveur` ;
- les journaux Vercel montrent un échec de requête Drizzle sur les tables de
  contenus. Ils ne prouvent pas encore si la cause est une migration manquante
  ou un contrat ancien devenu incompatible.

## Contre-vérification

Le dernier déploiement protégé de la branche, commit `5430ceb`, est `READY`.
Avec un accès temporaire Vercel, sa page `/prototype` répond `200` et son endpoint
`/api/content/public?limit=1` répond `200` avec `{ "items": [], "nextCursor": null }`.

## Décision de sécurité

Aucune promotion, modification d'alias, migration ou bascule DNS n'est faite par
ce lot. Avant de remplacer le déploiement public, il faut figer la version cible,
vérifier les variables et migrations de son environnement, exécuter la recette
publique et disposer d'un retour arrière validé.
