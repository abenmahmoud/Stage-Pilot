begin;

-- LOT 1 du 6 septembre 2026 (PLAN_DONNEES_REELLES) : le point d'écriture
-- `api/_shared/schedule-slot-write.ts` journalise chaque transformation
-- d'une page vérifiée en lignes de `schedule_slots` sous l'action
-- `write_slots`. Le check constraint d'origine ne connaissait pas cette
-- valeur.
alter table public.schedule_audit
  drop constraint schedule_audit_action_check;

alter table public.schedule_audit
  add constraint schedule_audit_action_check check (
    action in (
      'reserve_upload', 'confirm_upload', 'reject_upload', 'complete_scan',
      'index_page', 'verify_page', 'write_slots', 'approve', 'activate',
      'supersede', 'rollback', 'open_page', 'retire'
    )
  );

commit;
