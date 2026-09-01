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

## Diagnostic confirmé le 1er septembre 2026

- le domaine public est toujours servi par le déploiement production
  `dpl_41augagG39fL5gMXcud3WrWiZfQH`, créé le 28 août 2026 ;
- un nouvel appel borné à `GET /api/content/public?limit=1` répond toujours
  `500` avec le message public minimal ;
- les journaux de ce déploiement donnent désormais la cause exacte : PostgreSQL
  `42P01`, relation `site_content_items` inexistante ;
- les variables Vercel de production sont l'ancien jeu commun, tandis que la
  branche `codex/lycee-connect-prototype` possède son environnement de preview
  séparé ; aucune valeur secrète n'a été lue ou exportée ;
- le déploiement de preview `dpl_GNFgZzLAiNonQkFq2SQdN8ZxEact`, commit
  `fe7500e`, est `Ready` et son endpoint renvoie `200` avec le contrat exact
  `{ "items": [], "nextCursor": null, "scope": "current" }`.

Le défaut public ne vient donc pas du code courant : la cible de production
n'a pas le schéma éditorial attendu. Une promotion du code seule ne doit pas
être utilisée comme correction.

## Décision de sécurité

Aucune promotion, modification d'alias, migration ou bascule DNS n'est faite par
ce lot. Avant de remplacer le déploiement public, il faut figer la version cible,
préparer et sauvegarder la base cible, appliquer les migrations autorisées dans
le bon ordre, vérifier leur journal, exécuter la recette publique, puis disposer
d'un retour arrière validé. Ces actions nécessitent une autorisation distincte.
