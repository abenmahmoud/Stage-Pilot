# Brief d'audit Claude - récupération des communications sur la preview

## Statut

Préparé le 30 août 2026. Audit non exécuté : le modèle Claude exact et le plafond
de consommation propres à cette mission n'ont pas été confirmés. Zéro jeton
externe consommé.

## Périmètre strict

- `supabase/migrations/20260830130000_allow_communication_emergency_cancellation.sql`
- `supabase/migrations/20260830160000_restore_communication_approval_guards.sql`
- `supabase/tests/communication_job_recovery_security.test.sql`
- `api/_shared/communication-job-cancellation-persistence.ts`
- `api/_shared/communication-job-failure.ts`
- `api/_shared/communication-job-manual-retry-persistence.ts`
- `api/communications/admin/failures/index.ts`
- `api/communications/admin/failures/[id]/retry.ts`
- `api/communications/admin/jobs/[id]/cancel.ts`
- tests T020 associés

## Mission proposée

Auditer en lecture seule les courses entre worker, panne, reprise et annulation.
Vérifier que les gardes `approved/published` survivent aux remplacements de
fonctions, qu'un travail accepté n'est jamais exécuté deux fois, que
`running/sent` reste non rappelable, que la reprise humaine exige rôle, MFA et
confirmation, et qu'aucun identifiant ou texte fournisseur ne fuit.

Ne modifier aucun fichier, secret, environnement, base ou déploiement.

## Sortie attendue

Constats P0 à P3 avec fichier et ligne, scénario reproductible, correctif
minimal et test de non-régression. Mentionner explicitement si aucun défaut
bloquant supplémentaire n'est trouvé.
