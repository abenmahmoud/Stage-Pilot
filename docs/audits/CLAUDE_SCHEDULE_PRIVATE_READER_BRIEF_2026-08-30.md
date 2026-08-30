# Revue indépendante à autoriser - lecture privée des emplois du temps

## Statut

Préparée, non exécutée. Une autorisation courante doit nommer le modèle Claude,
confirmer ce périmètre et fixer un plafond de consommation.

## Objectif unique

Chercher une fuite d'emploi du temps, un croisement d'établissement ou une
réutilisation de source périmée dans le socle T042D2A, sans modifier les fichiers.

## Périmètre en lecture seule

- `supabase/migrations/20260830024727_create_private_schedule_slots.sql`
- `supabase/migrations/20260830024928_index_schedule_slots_scope_foreign_key.sql`
- `supabase/migrations/20260830025506_harden_schedule_slot_freshness.sql`
- `db/schema.ts`
- `api/_shared/schedule-reader.ts`
- `api/_shared/schedule-identity-reader.ts`
- `shared/schedule-policy.ts`
- `scripts/test-private-schedule-reader.mjs`
- `scripts/test-schedule-identity-reader.mjs`
- `scripts/test-schedule-policy.mjs`
- `docs/operations/SCHEDULE_PRIVATE_READER_PREVIEW_2026-08-30.md`

## Livrable attendu

Constats P0 à P3 avec fichier et ligne, scénario, correction minimale et test
manquant. Vérifier les clés composites, l'immuabilité, RLS et privilèges, les
limites de références, les versions concurrentes classes/personnel, la fraîcheur,
le cas vide et l'absence de référence d'un tiers dans la réponse.

## Interdictions

Pas de commande, pas d'écriture, pas de réseau, pas de secret, pas de donnée
réelle et pas de production. Arrêt après un rapport unique.
