# Brief Claude - flux public des informations

## Statut

Brief préparé, non exécuté. Le modèle Claude exact et le plafond de consommation
doivent être autorisés pour cette mission précise.

## Mission proposée

Auditer en lecture seule la recherche et les filtres publics, l'ordre éditorial,
la fenêtre de publication et le responsive. Chercher une fuite de brouillon,
une réintroduction d'un contenu expiré ou un débordement à 320 px.

## Périmètre minimal

- `shared/public-content-feed.ts` ;
- `api/content/public.ts` ;
- `src/pages/prototype/LyceeConnectPrototype.tsx`, section `NewsView` ;
- `src/pages/prototype/lycee-connect.css`, classes `lycee-news-*` ;
- `scripts/test-public-content-feed.mjs` ;
- diff Git du lot.

Aucun accès Vercel, Supabase, `.env`, contenu réel ou outil d'écriture.

## Questions

1. La recherche conserve-t-elle exactement l'ordre épinglé/date du serveur ?
2. Un brouillon, une archive ou un contenu expiré peut-il revenir dans la vue ?
3. Les contrôles restent-ils utilisables au clavier, lecteur d'écran et 320 px ?
4. Une requête de recherche ou une donnée interne est-elle transmise ou stockée ?

## Arrêt

Un rapport court classé par sévérité, avec fichier et correction minimale. Une
seule passe, sans relance ni élargissement.
