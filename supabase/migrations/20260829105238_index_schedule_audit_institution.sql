begin;

create index schedule_audit_institution_created_idx
  on public.schedule_audit (institution_id, created_at desc);

commit;
