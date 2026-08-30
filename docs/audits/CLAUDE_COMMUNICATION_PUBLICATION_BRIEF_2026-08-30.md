# Brief Claude - publication des communications

## Statut

Brief préparé, non exécuté. Le modèle Claude exact et le plafond de consommation
doivent être autorisés pour cette mission précise.

## Mission proposée

Auditer en lecture seule le passage relecture, validation direction et
publication publique. Chercher en priorité une course, un contournement des
interrupteurs, une publication d'une version non approuvée, une fuite de contenu
privé ou un état partiellement persisté.

## Périmètre minimal

- `shared/communication-publication.ts` ;
- `api/_shared/communications.ts` ;
- `api/communications/admin/[id]/review.ts` ;
- `api/communications/admin/[id]/approve.ts` ;
- `api/communications/admin/[id]/publish.ts` ;
- `src/pages/admin/CommunicationsPage.tsx` ;
- `scripts/test-communication-publication.mjs` ;
- diff Git du lot.

Aucun accès Vercel, Supabase, `.env`, secret ou donnée réelle.

## Questions

1. Une requête concurrente peut-elle publier deux articles ?
2. Les rôles, MFA, établissement et doubles interrupteurs ferment-ils le flux ?
3. La version créée dans le site correspond-elle exactement à la version validée ?
4. Une réponse API ou l'interface expose-t-elle du contenu ou un identifiant privé ?
5. Un échec intermédiaire laisse-t-il une publication partielle ?

## Arrêt

Un rapport court classé par sévérité, avec fichier et correction minimale. Une
seule passe, sans relance ni élargissement.
