begin;

alter table public.schedule_source_versions
  add constraint schedule_source_versions_freshness_period_check check (
    fresh_until is null
    or (
      fresh_until::date >= effective_from
      and (effective_until is null or fresh_until::date <= effective_until)
    )
  );

alter table public.schedule_source_versions
  validate constraint schedule_source_versions_active_freshness_check;

create unique index schedule_slots_source_identity_time_uidx
  on public.schedule_slots (
    source_version_id,
    coalesce(class_ref, ''),
    coalesce(group_ref, ''),
    coalesce(teacher_ref, ''),
    subject_code,
    starts_at,
    ends_at
  );

commit;
