begin;

create table public.regional_device_handoffs (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  school_year text not null default '2026-2027',
  student_name text not null check (char_length(student_name) between 2 and 160),
  class_name text not null check (char_length(class_name) between 1 and 60),
  student_key text not null check (student_key ~ '^[a-f0-9]{64}$'),
  status text not null default 'pending' check (status in ('pending', 'delivered', 'removed')),
  added_by uuid not null,
  delivered_by uuid,
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint regional_device_handoffs_delivery_consistency check (
    (status = 'delivered' and delivered_by is not null and delivered_at is not null)
    or (status <> 'delivered' and delivered_by is null and delivered_at is null)
  )
);

create unique index regional_device_handoffs_active_student
  on public.regional_device_handoffs(institution_id, school_year, student_key)
  where status <> 'removed';
create index regional_device_handoffs_queue
  on public.regional_device_handoffs(institution_id, school_year, status, created_at desc);

create table public.regional_device_handoff_events (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  handoff_id uuid not null references public.regional_device_handoffs(id) on delete cascade,
  action text not null check (action in ('created', 'delivered', 'reopened', 'removed')),
  actor_id uuid not null,
  created_at timestamptz not null default now()
);
create index regional_device_handoff_events_history
  on public.regional_device_handoff_events(handoff_id, created_at desc);

alter table public.regional_device_handoffs enable row level security;
alter table public.regional_device_handoffs force row level security;
alter table public.regional_device_handoff_events enable row level security;
alter table public.regional_device_handoff_events force row level security;
revoke all on table public.regional_device_handoffs, public.regional_device_handoff_events
  from public, anon, authenticated;
grant select, insert, update on table public.regional_device_handoffs to service_role;
grant select, insert on table public.regional_device_handoff_events to service_role;

comment on table public.regional_device_handoffs is
  'Private, manually verified queue for regional Chromebook delivery. No automatic absence inference.';

commit;
