begin;

create table public.person_attribute_imports (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete restrict,
  checksum text not null check (checksum ~ '^[a-f0-9]{64}$'),
  original_name text not null check (char_length(original_name) between 1 and 255),
  size_bytes bigint not null check (size_bytes between 1 and 4194304),
  row_count integer not null check (row_count between 1 and 25000),
  status text not null default 'review' check (status in ('review', 'active', 'superseded', 'rejected')),
  uploaded_by uuid not null references auth.users(id) on delete restrict,
  approved_by uuid references auth.users(id) on delete restrict,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (institution_id, checksum),
  unique (id, institution_id)
);

create table public.person_attribute_rows (
  id uuid primary key,
  institution_id uuid not null references public.institutions(id) on delete restrict,
  import_id uuid not null,
  person_ref text not null check (person_ref ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{3,199}$'),
  attribute_key text not null check (attribute_key ~ '^[a-z][a-z0-9_]{1,63}$'),
  valid_from date not null,
  valid_until date,
  source text not null check (char_length(source) between 1 and 120),
  key_version text not null check (key_version ~ '^v[1-9][0-9]{0,3}$'),
  payload_schema integer not null default 1 check (payload_schema = 1),
  iv text not null check (iv ~ '^[A-Za-z0-9+/]{16}$'),
  auth_tag text not null check (auth_tag ~ '^[A-Za-z0-9+/]{22}==$'),
  ciphertext text not null check (ciphertext ~ '^[A-Za-z0-9+/]+={0,2}$'),
  created_at timestamptz not null default now(),
  constraint person_attribute_rows_import_scope_fk
    foreign key (import_id, institution_id)
    references public.person_attribute_imports(id, institution_id) on delete cascade,
  constraint person_attribute_rows_date_check check (valid_until is null or valid_until >= valid_from),
  unique (import_id, person_ref, attribute_key, valid_from)
);

create index person_attribute_imports_status_idx
  on public.person_attribute_imports (institution_id, status, created_at desc);
create index person_attribute_rows_lookup_idx
  on public.person_attribute_rows (institution_id, person_ref, attribute_key, valid_from desc);

create trigger person_attribute_imports_set_updated_at
before update on public.person_attribute_imports
for each row execute function public.support_set_updated_at();

alter table public.person_attribute_imports enable row level security;
alter table public.person_attribute_imports force row level security;
alter table public.person_attribute_rows enable row level security;
alter table public.person_attribute_rows force row level security;

revoke all on table public.person_attribute_imports from public, anon, authenticated;
revoke all on table public.person_attribute_rows from public, anon, authenticated;
grant select, insert, update on table public.person_attribute_imports to service_role;
grant select, insert on table public.person_attribute_rows to service_role;

comment on table public.person_attribute_imports is
  'Imports nominatifs chiffrés reçus du Dépôt Lycée, inactifs avant validation humaine.';
comment on column public.person_attribute_rows.ciphertext is
  'Valeur nominative chiffrée en AES-256-GCM, jamais destinée au contexte d un modèle.';

commit;
