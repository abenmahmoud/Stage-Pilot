begin;

create index communication_settings_updated_by_fk_idx
  on public.communication_settings (updated_by)
  where updated_by is not null;
create index communication_versions_communication_scope_fk_idx
  on public.communication_versions (communication_id, institution_id);
create index communication_audiences_communication_scope_fk_idx
  on public.communication_audiences (communication_id, institution_id);
create index communication_deliveries_communication_scope_fk_idx
  on public.communication_deliveries (communication_id, institution_id);
create index communication_deliveries_version_scope_fk_idx
  on public.communication_deliveries (version_id, institution_id, communication_id, version);
create index communication_jobs_communication_scope_fk_idx
  on public.communication_jobs (communication_id, institution_id);
create index communication_jobs_version_scope_fk_idx
  on public.communication_jobs (version_id, institution_id, communication_id, version)
  where version_id is not null;
create index communication_jobs_delivery_scope_fk_idx
  on public.communication_jobs (delivery_id, institution_id)
  where delivery_id is not null;
create index communication_events_communication_scope_fk_idx
  on public.communication_events (communication_id, institution_id);

commit;
