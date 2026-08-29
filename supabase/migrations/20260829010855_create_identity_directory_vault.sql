begin;

create table public.identity_directory_private_rows (
  id bigint generated always as identity primary key,
  institution_id uuid not null references public.institutions(id) on delete cascade,
  import_id uuid not null,
  person_ref text not null check (length(btrim(person_ref)) between 3 and 120),
  key_version text not null check (key_version ~ '^v[1-9][0-9]{0,3}$'),
  payload_schema smallint not null default 1 check (payload_schema = 1),
  iv text not null check (
    length(iv) between 16 and 24 and iv ~ '^[A-Za-z0-9+/]+={0,2}$'
  ),
  auth_tag text not null check (
    length(auth_tag) between 20 and 32 and auth_tag ~ '^[A-Za-z0-9+/]+={0,2}$'
  ),
  ciphertext text not null check (
    length(ciphertext) between 16 and 8192
    and ciphertext ~ '^[A-Za-z0-9+/]+={0,2}$'
  ),
  created_at timestamptz not null default now(),
  foreign key (import_id, institution_id)
    references public.identity_directory_imports(id, institution_id) on delete cascade,
  unique (import_id, person_ref)
);

create index identity_directory_private_rows_import_institution_idx
  on public.identity_directory_private_rows (import_id, institution_id);

alter table public.identity_directory_private_rows enable row level security;
alter table public.identity_directory_private_rows force row level security;

revoke all on table public.identity_directory_private_rows
from public, anon, authenticated;
grant select, insert, update, delete on table public.identity_directory_private_rows
to service_role;
grant usage, select on sequence public.identity_directory_private_rows_id_seq
to service_role;

comment on table public.identity_directory_private_rows is
  'Application-encrypted operational identity payloads. Never general AI knowledge.';
comment on column public.identity_directory_private_rows.ciphertext is
  'AES-256-GCM ciphertext bound to institution, import version and person reference.';

commit;
