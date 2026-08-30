# Brief Claude - pagination publique des informations

## Statut

Brief préparé, non exécuté. Le modèle Claude exact et le plafond de consommation
doivent être autorisés pour cette mission précise.

## Mission proposée

Auditer en lecture seule le curseur public, l'ordre SQL et la fusion côté client.
Chercher doublon, saut d'élément, contournement de limite, retour d'un contenu
non public ou fuite de donnée dans le curseur et la réponse.

## Périmètre minimal

- `api/_shared/public-content-pagination.ts` ;
- `api/content/public.ts` ;
- `src/pages/prototype/LyceeConnectPrototype.tsx`, section `NewsView` ;
- `scripts/test-public-content-feed.mjs` ;
- diff Git du lot.

Aucun accès Vercel, Supabase, `.env`, donnée réelle ou outil d'écriture.

## Questions

1. Le triplet priorité, date et identifiant produit-il un ordre total stable ?
2. Une modification du curseur peut-elle élargir la lecture ou la taille ?
3. Les contrôles SQL et instantané excluent-ils toujours le non-public ?
4. Une panne ou un double clic peut-il dupliquer ou supprimer des éléments ?

## Arrêt

Un rapport court classé par sévérité, avec fichier et correction minimale. Une
seule passe, sans relance ni élargissement.
