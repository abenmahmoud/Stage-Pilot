# Récupération des travaux de communication sur la preview

## Périmètre

T020 est prouvé uniquement sur le projet Supabase de preview
`xijocumlwivhbmffrnlj`. Aucun worker, Cron, webhook, transport Webmail, appel
Brevo ou donnée réelle n'est utilisé.

## Migrations exactes

- `20260830130000_allow_communication_emergency_cancellation`
- `20260830160000_restore_communication_approval_guards`

La seconde migration rétablit les contrôles d'approbation que la première
version risquait d'écraser. La migration historique est également corrigée pour
qu'une nouvelle base soit protégée pendant toute la séquence.

## Recette transactionnelle

`supabase/tests/communication_job_recovery_security.test.sql` vérifie avec des
identifiants réservés et fictifs :

- qu'une livraison issue d'un brouillon est refusée ;
- qu'une panne peut devenir `dead/error` avec un code fermé ;
- qu'un successeur de reprise reste unique après rejeu ;
- qu'un travail `pending` et une livraison `prepared` peuvent être annulés
  lorsque les interrupteurs sont coupés ;
- qu'un travail `running` et une livraison `sent` ne peuvent pas être
  rappelés ;
- qu'`anon` et `authenticated` n'ont aucun privilège direct sur les travaux
  et livraisons ;
- que le rollback laisse six compteurs de résidus à zéro.

## Advisors

L'advisor de sécurité Supabase retourne 60 informations et aucun `WARN` ou
`ERROR`. Pour `communication_jobs` et `communication_deliveries`, l'absence
de politique RLS est intentionnelle car les tables sont réservées au serveur et
la recette vérifie l'absence de privilèges clients :
https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy

Les index de file sont signalés comme inutilisés au niveau `INFO`, ce qui est
normal sur une preview vide et ne justifie pas leur suppression avant les tests
de charge :
https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index
