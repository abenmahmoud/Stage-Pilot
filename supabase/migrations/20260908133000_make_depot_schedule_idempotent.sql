begin;

create unique index schedule_source_versions_checksum_uidx
  on public.schedule_source_versions (institution_id, source_kind, school_year, checksum)
  where checksum is not null and status not in ('rejected', 'failed', 'retired');

commit;
