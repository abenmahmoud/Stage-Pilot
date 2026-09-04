begin;

create table public.communication_nominative_imports (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete restrict,
  source_ref text not null check (source_ref ~ '^[a-zA-Z0-9][a-zA-Z0-9:_-]{7,119}$'),
  school_year text not null check (school_year ~ '^20[0-9]{2}-20[0-9]{2}$' and right(school_year, 4)::integer = left(school_year, 4)::integer + 1),
  source_fingerprint text not null check (source_fingerprint ~ '^[a-f0-9]{64}$'),
  scope_hash text not null check (scope_hash ~ '^[a-f0-9]{64}$'),
  status text not null default 'ready' check (status in ('ready', 'approved', 'revoked')),
  template jsonb not null check (jsonb_typeof(template) = 'object'),
  report jsonb not null check (jsonb_typeof(report) = 'object'),
  frozen_batch jsonb not null check (jsonb_typeof(frozen_batch) = 'object'),
  ready_count integer not null check (ready_count between 1 and 5000),
  created_by uuid not null references auth.users(id) on delete restrict,
  approved_by uuid references auth.users(id) on delete restrict,
  approved_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default transaction_timestamp(),
  unique (id, institution_id),
  unique (institution_id, source_fingerprint),
  check (status <> 'approved' or (approved_by is not null and approved_at is not null)),
  check (status <> 'revoked' or revoked_at is not null)
);
create index communication_nominative_imports_scope_idx on public.communication_nominative_imports(institution_id, created_at);
create index communication_nominative_imports_created_by_idx on public.communication_nominative_imports(created_by);
create index communication_nominative_imports_approved_by_idx on public.communication_nominative_imports(approved_by) where approved_by is not null;

create table public.communication_nominative_values (
  import_id uuid not null,
  institution_id uuid not null,
  beneficiary_ref text not null check (beneficiary_ref ~ '^[a-zA-Z0-9][a-zA-Z0-9:_-]{7,119}$'),
  contact_ref text not null check (contact_ref ~ '^[a-zA-Z0-9][a-zA-Z0-9:_-]{7,119}$'),
  value_version text not null check (value_version ~ '^[a-f0-9]{64}$'),
  key_version text not null check (key_version ~ '^v[1-9][0-9]{0,3}$'),
  iv text not null check (length(iv) = 16),
  auth_tag text not null check (length(auth_tag) = 24),
  ciphertext text not null check (length(ciphertext) between 1 and 22000),
  revoked_at timestamptz,
  primary key (import_id, beneficiary_ref),
  unique (import_id, institution_id, beneficiary_ref),
  foreign key (import_id, institution_id) references public.communication_nominative_imports(id, institution_id) on delete restrict
);
create index communication_nominative_values_scope_idx on public.communication_nominative_values(institution_id, beneficiary_ref);

create table public.communication_nominative_delivery_values (
  delivery_id uuid primary key,
  institution_id uuid not null,
  import_id uuid not null,
  beneficiary_ref text not null,
  dispatch_state text not null default 'prepared' check (dispatch_state in ('prepared', 'dispatching', 'accepted', 'uncertain')),
  dispatched_at timestamptz,
  check (dispatch_state = 'prepared' or dispatched_at is not null),
  foreign key (delivery_id, institution_id) references public.communication_deliveries(id, institution_id) on delete restrict,
  foreign key (import_id, institution_id, beneficiary_ref) references public.communication_nominative_values(import_id, institution_id, beneficiary_ref) on delete restrict,
  unique (import_id, beneficiary_ref)
);
create index communication_nominative_delivery_scope_idx on public.communication_nominative_delivery_values(institution_id, delivery_id);

create function public.communication_guard_nominative_import()
returns trigger language plpgsql set search_path = '' as $$
begin
  if (to_jsonb(new) - array['status','approved_by','approved_at','revoked_at'])
    is distinct from (to_jsonb(old) - array['status','approved_by','approved_at','revoked_at'])
    or (old.status = 'revoked' and new is distinct from old)
    or (old.status = 'approved' and new.status not in ('approved','revoked'))
    or (old.approved_at is not null and (new.approved_at is distinct from old.approved_at or new.approved_by is distinct from old.approved_by)) then
    raise exception 'Nominative import is immutable';
  end if;
  return new;
end $$;
create trigger communication_nominative_import_immutable before update on public.communication_nominative_imports
  for each row execute function public.communication_guard_nominative_import();

alter table public.communication_nominative_imports enable row level security;
alter table public.communication_nominative_imports force row level security;
alter table public.communication_nominative_values enable row level security;
alter table public.communication_nominative_values force row level security;
alter table public.communication_nominative_delivery_values enable row level security;
alter table public.communication_nominative_delivery_values force row level security;
revoke all on public.communication_nominative_imports, public.communication_nominative_values, public.communication_nominative_delivery_values from public, anon, authenticated;
grant select, insert, update on public.communication_nominative_imports to service_role;
grant select, insert on public.communication_nominative_values, public.communication_nominative_delivery_values to service_role;
grant update(dispatch_state, dispatched_at) on public.communication_nominative_delivery_values to service_role;
grant update(revoked_at) on public.communication_nominative_values to service_role;
revoke all on function public.communication_guard_nominative_import() from public, anon, authenticated;
comment on table public.communication_nominative_values is 'Private per-beneficiary AES-256-GCM envelopes. Worker only; no names, email addresses or values in plaintext.';

commit;
