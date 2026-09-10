begin;

alter table public.schedule_source_versions drop constraint schedule_source_versions_source_format_check;
alter table public.schedule_source_versions add constraint schedule_source_versions_source_format_check
  check (source_format in ('pdf_import', 'tabular_import', 'ical_import'));
alter table public.schedule_source_versions drop constraint schedule_source_versions_mime_type_check;
alter table public.schedule_source_versions add constraint schedule_source_versions_mime_type_check check (
  (source_format = 'pdf_import' and mime_type = 'application/pdf') or
  (source_format = 'tabular_import' and mime_type in ('text/csv', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')) or
  (source_format = 'ical_import' and mime_type = 'text/calendar')
);
update storage.buckets set allowed_mime_types = array['application/pdf', 'text/csv', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'text/calendar']
where id = 'schedule-ingest' and public = false;

create table public.schedule_ical_candidates (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete restrict,
  source_version_id uuid not null references public.schedule_source_versions(id) on delete cascade,
  calendar_number integer not null check (calendar_number between 1 and 250),
  calendar_label text not null check (length(calendar_label) between 1 and 180),
  suggested_ref text,
  subject_ref text,
  directory_import_id uuid references public.identity_directory_imports(id) on delete restrict,
  match_status text not null check (match_status in ('exact', 'not_found', 'ambiguous', 'empty')),
  events jsonb not null check (jsonb_typeof(events) = 'array' and jsonb_array_length(events) <= 5000),
  stats jsonb not null check (jsonb_typeof(stats) = 'object'),
  decision text check (decision in ('include', 'exclude')),
  status text not null default 'pending' check (status in ('pending', 'queued', 'applied', 'failed')),
  approved_by uuid references auth.users(id) on delete restrict,
  approved_at timestamptz,
  applied_at timestamptz,
  failure_code text,
  created_at timestamptz not null default now(),
  unique (source_version_id, calendar_number),
  foreign key (source_version_id, institution_id) references public.schedule_source_versions(id, institution_id) on delete cascade,
  check (status = 'pending' or (approved_by is not null and approved_at is not null and decision is not null)),
  check (decision is distinct from 'include' or (subject_ref is not null and subject_ref ~ '^[A-Z0-9][A-Z0-9._:-]{1,79}$'))
);
create index schedule_ical_candidates_scope_idx on public.schedule_ical_candidates(institution_id, source_version_id);
create index schedule_ical_candidates_queue_idx on public.schedule_ical_candidates(status, approved_at) where status = 'queued';
create unique index schedule_ical_candidates_subject_idx on public.schedule_ical_candidates(source_version_id, subject_ref)
where decision = 'include';

-- The staging source is always in the same establishment and still under review.
create function public.schedule_validate_ical_candidate() returns trigger language plpgsql set search_path = public as $$
declare source_row record;
begin
  select institution_id, source_format, status into source_row from public.schedule_source_versions where id = new.source_version_id;
  if not found or source_row.institution_id <> new.institution_id or source_row.source_format <> 'ical_import' then
    raise exception 'Invalid iCal candidate scope';
  end if;
  if tg_op = 'UPDATE' and (new.source_version_id <> old.source_version_id or new.institution_id <> old.institution_id
      or new.calendar_number <> old.calendar_number or new.events <> old.events) then
    raise exception 'Immutable iCal candidate source';
  end if;
  if source_row.status not in ('processing', 'review') then raise exception 'iCal source no longer editable'; end if;
  return new;
end;
$$;
create trigger schedule_ical_candidates_validate before insert or update on public.schedule_ical_candidates
for each row execute function public.schedule_validate_ical_candidate();
revoke all on function public.schedule_validate_ical_candidate() from public, anon, authenticated;
grant execute on function public.schedule_validate_ical_candidate() to service_role;
alter table public.schedule_ical_candidates enable row level security;
alter table public.schedule_ical_candidates force row level security;
revoke all on public.schedule_ical_candidates from public, anon, authenticated;
grant select, insert, update, delete on public.schedule_ical_candidates to service_role;

commit;
