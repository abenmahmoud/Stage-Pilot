# Migration Vercel + Supabase

Branche de travail pour migrer Stage-Pilot de Netlify vers Vercel + Supabase.

## Changements apportés

- ✅ Remplacement de `@netlify/database` par `postgres` (driver Postgres direct)
- ✅ Remplacement de `@netlify/identity` par `@supabase/supabase-js` (Supabase Auth)
- ✅ Conversion des `netlify/functions/*.mts` en `api/*.ts` (Vercel Functions)
- ✅ Migration du schéma `serial` (int) vers `uuid` pour matcher la base Supabase
- ✅ Lien `auth_user_id uuid references auth.users(id)` sur eleves et professeurs
- ✅ Frontend adapté pour passer les UUID en string
- ✅ Suppression de `netlify.toml`, ajout de `vercel.json`

## Variables d'environnement requises sur Vercel

Voir `.env.local.example`. Toutes doivent être configurées dans le projet Vercel :
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `DATABASE_URL`
- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_APP_NAME`

## Mise en veille hors saison

Pour économiser les coûts hors période d'usage (août-mai) :

1. **Supabase** : Dashboard → Project Settings → General → "Pause project"
2. **Vercel** : Le projet reste actif gratuitement sur plan Hobby (pas d'action requise)
3. **Réveil** : Cliquer "Restore project" sur Supabase, attendre 1-2 min

## Rôles utilisateurs

Stockés dans `auth.users.app_metadata.role` :
- `superadmin` - accès total, gestion admin
- `administration` - gestion stages, validation
- `pp` - professeur principal, affectation référents
- `professeur` - prof référent stage ou prof spé GO
- `proviseur` - cachet final fiches GO
- `eleve` - saisie stage et fiche GO

## Build local

```bash
npm install
cp .env.local.example .env.local  # puis remplir les valeurs
npm run dev
```

## Schéma DB

Le schéma est déjà appliqué sur Supabase via les migrations `001_initial_schema` et
`002_rls_and_triggers`. Pour reproduire ailleurs, voir `db/schema.ts`.
