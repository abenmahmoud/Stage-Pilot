# Brief d'audit Claude - assistance et relecture des communications

## Statut

Préparé le 30 août 2026. Audit non exécuté : le modèle Claude exact et la limite
de consommation propres à cette mission n'ont pas été confirmés.

## Périmètre strict

- `shared/communication-draft.ts`
- `shared/communication-assist.ts`
- `api/communications/admin/index.ts`
- `api/communications/admin/assist.ts`
- `api/communications/admin/[id]/index.ts`
- `api/communications/admin/[id]/review.ts`
- `src/pages/admin/CommunicationsPage.tsx`
- `supabase/migrations/20260830080000_harden_communication_review_lifecycle.sql`
- `supabase/migrations/20260830082000_retain_and_attach_communication_versions.sql`
- `supabase/tests/communication_review_lifecycle_security.test.sql`
- tests `communication-draft`, `communication-assist`, `communication-review`
  et `communication-ui`

## Mission proposée

Auditer en lecture seule les rôles, le cloisonnement établissement, les courses
concurrentes, l'idempotence, la séquence de versions, les transitions SQL, les
sorties structurées, l'injection de consignes, les secrets, les données
personnelles, la non-invention et l'ergonomie responsive. Vérifier qu'aucune
route ne peut sélectionner une audience, approuver, publier ou envoyer. Ne
modifier aucun fichier et ne manipuler aucune donnée réelle.

## Sortie attendue

- constats classés par sévérité avec fichier et ligne ;
- scénario minimal de reproduction ;
- mention explicite si aucun défaut bloquant n'est trouvé ;
- risques résiduels séparés des défauts confirmés.
