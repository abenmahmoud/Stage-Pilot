create index schedule_slots_source_institution_idx
  on public.schedule_slots (source_version_id, institution_id);
