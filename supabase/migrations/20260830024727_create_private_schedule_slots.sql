begin;

alter table public.schedule_source_versions
  add column effective_until date,
  add column fresh_until timestamptz,
  add constraint schedule_source_versions_effective_period_check check (
    effective_until is null or effective_until >= effective_from
  ),
  add constraint schedule_source_versions_active_freshness_check check (
    status <> 'active' or fresh_until is not null
  ) not valid;

create table public.schedule_slots (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  source_version_id uuid not null,
  class_ref text,
  group_ref text,
  teacher_ref text,
  subject_code text not null,
  subject_label text not null,
  room_code text,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  week_pattern text,
  parse_confidence numeric(4, 3) not null default 0,
  review_status text not null default 'pending',
  reviewed_by uuid references auth.users(id) on delete restrict,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, institution_id),
  foreign key (source_version_id, institution_id)
    references public.schedule_source_versions(id, institution_id) on delete cascade,
  check (num_nonnulls(class_ref, group_ref, teacher_ref) >= 1),
  check (class_ref is null or class_ref ~ '^[A-Z0-9][A-Z0-9._:-]{1,79}$'),
  check (group_ref is null or group_ref ~ '^[A-Z0-9][A-Z0-9._:-]{1,79}$'),
  check (teacher_ref is null or teacher_ref ~ '^[A-Z0-9][A-Z0-9._:-]{1,79}$'),
  check (subject_code ~ '^[A-Z0-9][A-Z0-9._:-]{0,31}$'),
  check (length(btrim(subject_label)) between 2 and 120),
  check (room_code is null or length(btrim(room_code)) between 1 and 40),
  check (ends_at > starts_at),
  check (parse_confidence between 0 and 1),
  check (review_status in ('pending', 'approved', 'rejected')),
  check (
    review_status = 'pending'
    or (reviewed_by is not null and reviewed_at is not null)
  )
);

create index schedule_slots_source_start_idx
  on public.schedule_slots (source_version_id, starts_at, ends_at);
create index schedule_slots_class_start_idx
  on public.schedule_slots (institution_id, class_ref, starts_at)
  where class_ref is not null and review_status = 'approved';
create index schedule_slots_group_start_idx
  on public.schedule_slots (institution_id, group_ref, starts_at)
  where group_ref is not null and review_status = 'approved';
create index schedule_slots_teacher_start_idx
  on public.schedule_slots (institution_id, teacher_ref, starts_at)
  where teacher_ref is not null and review_status = 'approved';
create index schedule_slots_reviewed_by_idx
  on public.schedule_slots (reviewed_by, reviewed_at)
  where reviewed_by is not null;

create trigger schedule_slots_set_updated_at
before update on public.schedule_slots
for each row execute function public.support_set_updated_at();

create or replace function public.schedule_slots_guard_source()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  source_status text;
begin
  if tg_op = 'UPDATE' and (
    new.institution_id <> old.institution_id
    or new.source_version_id <> old.source_version_id
  ) then
    raise exception 'Schedule slot scope is immutable';
  end if;

  select status
    into source_status
  from public.schedule_source_versions
  where id = coalesce(new.source_version_id, old.source_version_id)
    and institution_id = coalesce(new.institution_id, old.institution_id)
  for key share;

  if source_status is null then
    raise exception 'Schedule source is unavailable';
  end if;
  if source_status in ('active', 'superseded', 'retired') then
    raise exception 'Activated schedule slots are immutable';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger schedule_slots_guard_source_trigger
before insert or update or delete on public.schedule_slots
for each row execute function public.schedule_slots_guard_source();

alter table public.schedule_slots enable row level security;
alter table public.schedule_slots force row level security;

revoke all on table public.schedule_slots from public, anon, authenticated;
grant select, insert, update, delete on table public.schedule_slots to service_role;

commit;
