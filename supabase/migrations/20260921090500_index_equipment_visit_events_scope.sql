begin;

create index if not exists equipment_service_visit_events_institution_idx
  on public.equipment_service_visit_events(institution_id);

commit;
