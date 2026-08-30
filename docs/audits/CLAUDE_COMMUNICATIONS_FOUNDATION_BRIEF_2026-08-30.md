# Revue indépendante à autoriser - fondation communications

## Statut

Préparée, non exécutée. L'autorisation doit encore nommer le modèle Claude,
confirmer ce périmètre et fixer un plafond de consommation.

## Objectif unique

Chercher une fuite de destinataire, un croisement d'établissement, un
contournement des interrupteurs, une mutation après validation ou un défaut
d'idempotence dans la fondation privée de `005`, sans modifier les fichiers.

## Périmètre en lecture seule

- `shared/communication-policy.ts`
- `api/_shared/communication-flags.ts`
- `db/schema.ts`
- `supabase/migrations/20260830053500_create_private_communications_foundation.sql`
- `supabase/migrations/20260830054500_enforce_communication_kill_switches.sql`
- `supabase/migrations/20260830055500_require_approved_communication_work.sql`
- `supabase/migrations/20260830060500_harden_communication_scope.sql`
- `supabase/migrations/20260830061500_index_communication_foreign_keys.sql`
- `scripts/test-communication-policy.mjs`
- `scripts/test-communication-foundation.mjs`
- `supabase/tests/communication_foundation_security.test.sql`
- `specs/005-centre-communications/data-model.md`
- `docs/operations/COMMUNICATIONS_FOUNDATION_PREVIEW_2026-08-30.md`

## Livrable attendu

Constats P0 à P3 avec fichier et ligne, scénario, correction minimale et test
manquant. Vérifier les clés composites, privilèges, RLS, fonctions et verrous,
les transitions concurrentes, l'immutabilité, l'absence d'adresse, l'ordre des
index, les statuts de file et la séparation publication/envoi.

## Interdictions

Pas de commande, pas d'écriture, pas de réseau, pas de secret, pas de donnée
réelle et pas de production. Arrêt après un rapport unique.
