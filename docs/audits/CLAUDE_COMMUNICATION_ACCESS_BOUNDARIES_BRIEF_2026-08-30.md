# Brief Claude - frontières d'accès des communications

## Statut

Brief préparé, non exécuté. Le modèle Claude exact et le plafond de consommation
doivent être autorisés pour cette mission précise.

## Mission proposée

Auditer en lecture seule la séparation entre routes privées de communication et
API publique de contenus. Chercher un contournement de rôle, MFA, établissement,
visibilité ou fenêtre de publication, ainsi qu'une fuite de métadonnée interne.

## Périmètre minimal

- `api/_shared/communications.ts` ;
- `api/communications/admin/[id]/publish.ts` ;
- `api/content/public.ts` ;
- `scripts/test-communication-authorization.mjs` ;
- `scripts/test-communication-output-privacy.mjs` ;
- diff Git du lot.

Aucun accès Vercel, Supabase, `.env`, donnée réelle ou outil d'écriture.

## Arrêt

Une seule passe, rapport court par sévérité avec fichier, preuve et correction
minimale. Aucune relance ni extension de périmètre.
