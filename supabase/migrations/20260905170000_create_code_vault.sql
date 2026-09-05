begin;

-- LOT 2 du plan du coffre de codes (2026-09-05) : schéma chiffré, séparé du
-- registre de connaissances (`identity_directory_*`, `knowledge_document_*`).
-- Aucune valeur de code en clair ne peut être stockée : la valeur ne vit que
-- dans `code_vault_private_rows`, sous forme chiffrée, sur le motif de
-- `identity_directory_private_rows`. Les autres tables ne portent jamais de
-- colonne susceptible de recevoir un fragment de valeur.

create table public.code_vault_assignments (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete restrict,
  person_ref text not null check (length(btrim(person_ref)) between 3 and 120),
  service text not null check (service in ('ent', 'cantine', 'koxo')),
  school_year text not null check (school_year ~ '^[0-9]{4}-[0-9]{4}$'),
  version integer not null check (version between 1 and 10000),
  status text not null default 'disponible' check (
    status in ('disponible', 'reserve', 'remis', 'utilise')
  ),
  created_at timestamptz not null default transaction_timestamp(),
  updated_at timestamptz not null default transaction_timestamp(),
  unique (id, institution_id),
  -- Le quadruplet du plan (personne, service, année scolaire, version), scopé
  -- par établissement : une seule attribution par quadruplet (§LOT1,
  -- `vaultAssignmentKey`).
  unique (institution_id, person_ref, service, school_year, version)
);

create index code_vault_assignments_scope_person_idx
  on public.code_vault_assignments (institution_id, person_ref, service);
create index code_vault_assignments_scope_status_idx
  on public.code_vault_assignments (institution_id, status);

-- Valeur chiffrée au repos. Table séparée de `code_vault_assignments` à
-- dessein : la ligne d'attribution reste consultable pour l'état et les
-- autorisations sans jamais donner accès à la valeur, et une révocation de
-- privilège sur cette seule table suffit à couper tout accès à la valeur.
create table public.code_vault_private_rows (
  id bigint generated always as identity primary key,
  institution_id uuid not null references public.institutions(id) on delete restrict,
  assignment_id uuid not null,
  key_version text not null check (key_version ~ '^v[1-9][0-9]{0,3}$'),
  payload_schema smallint not null default 1 check (payload_schema = 1),
  iv text not null check (
    length(iv) between 16 and 24 and iv ~ '^[A-Za-z0-9+/]+={0,2}$'
  ),
  auth_tag text not null check (
    length(auth_tag) between 20 and 32 and auth_tag ~ '^[A-Za-z0-9+/]+={0,2}$'
  ),
  -- Borne volontairement courte : un code d'accès (ENT, cantine, Koxo) ne
  -- produit jamais un chiffré de plusieurs centaines d'octets. Une valeur
  -- plus grande est structurellement rejetée, pas seulement déconseillée.
  ciphertext text not null check (
    length(ciphertext) between 16 and 512
    and ciphertext ~ '^[A-Za-z0-9+/]+={0,2}$'
  ),
  created_at timestamptz not null default transaction_timestamp(),
  updated_at timestamptz not null default transaction_timestamp(),
  foreign key (assignment_id, institution_id)
    references public.code_vault_assignments(id, institution_id) on delete restrict,
  unique (assignment_id, institution_id)
);

create index code_vault_private_rows_scope_idx
  on public.code_vault_private_rows (institution_id, assignment_id);

-- Journal d'accès : jamais de valeur, jamais de fragment. Uniquement ce que
-- le modèle a le droit de voir (§LOT1, `ModelVisibleVaultFact`) plus
-- l'identité de l'acteur et, en cas de refus, le motif.
create table public.code_vault_access_events (
  id bigint generated always as identity primary key,
  institution_id uuid not null references public.institutions(id) on delete restrict,
  assignment_id uuid,
  actor_person_ref text check (
    actor_person_ref is null or length(btrim(actor_person_ref)) between 3 and 120
  ),
  actor_profile text not null check (
    actor_profile in ('eleve', 'professeur', 'professeur_principal', 'service', 'superadmin', 'parent')
  ),
  event_type text not null check (
    event_type in ('consult', 'activation_confirmed', 'authorized_validation', 'access_denied')
  ),
  refusal_reason text check (
    refusal_reason is null or refusal_reason in (
      'parent_to_child_forbidden',
      'institution_mismatch',
      'self_only',
      'cantine_availability_not_validated',
      'professeur_principal_ent_forbidden',
      'professeur_principal_single_active_code_required',
      'professeur_principal_class_not_validated',
      'service_scope_required'
    )
  ),
  created_at timestamptz not null default transaction_timestamp(),
  foreign key (assignment_id, institution_id)
    references public.code_vault_assignments(id, institution_id) on delete restrict,
  check ((event_type = 'access_denied') = (refusal_reason is not null))
);

create index code_vault_access_events_scope_created_idx
  on public.code_vault_access_events (institution_id, assignment_id, created_at desc);
create index code_vault_access_events_denied_idx
  on public.code_vault_access_events (institution_id, created_at desc)
  where event_type = 'access_denied';

create or replace function public.code_vault_set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := transaction_timestamp();
  return new;
end;
$$;

create or replace function public.code_vault_assignment_insert_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status <> 'disponible' then
    raise exception 'code_vault_assignment_must_start_disponible';
  end if;
  return new;
end;
$$;

create or replace function public.code_vault_assignment_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.institution_id <> old.institution_id
    or new.person_ref <> old.person_ref
    or new.service <> old.service
    or new.school_year <> old.school_year
    or new.version <> old.version
    or new.created_at <> old.created_at then
    raise exception 'code_vault_assignment_identity_is_immutable';
  end if;

  if old.status = new.status then
    return new;
  end if;

  if not (
    (old.status = 'disponible' and new.status = 'reserve')
    or (old.status = 'reserve' and new.status = 'remis')
    or (old.status = 'remis' and new.status = 'utilise')
  ) then
    raise exception 'invalid_code_vault_assignment_transition';
  end if;
  return new;
end;
$$;

create or replace function public.code_vault_private_row_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.institution_id <> old.institution_id or new.assignment_id <> old.assignment_id then
    raise exception 'code_vault_private_row_scope_is_immutable';
  end if;
  return new;
end;
$$;

create or replace function public.code_vault_access_events_append_only()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'code_vault_access_events_are_append_only';
end;
$$;

create trigger code_vault_assignments_insert_guard_trigger
before insert on public.code_vault_assignments
for each row execute function public.code_vault_assignment_insert_guard();
create trigger code_vault_assignments_guard_trigger
before update on public.code_vault_assignments
for each row execute function public.code_vault_assignment_guard();
create trigger code_vault_assignments_set_updated_at_trigger
before update on public.code_vault_assignments
for each row execute function public.code_vault_set_updated_at();

create trigger code_vault_private_rows_guard_trigger
before update on public.code_vault_private_rows
for each row execute function public.code_vault_private_row_guard();
create trigger code_vault_private_rows_set_updated_at_trigger
before update on public.code_vault_private_rows
for each row execute function public.code_vault_set_updated_at();

create trigger code_vault_access_events_append_only_trigger
before update or delete on public.code_vault_access_events
for each row execute function public.code_vault_access_events_append_only();

alter table public.code_vault_assignments enable row level security;
alter table public.code_vault_assignments force row level security;
alter table public.code_vault_private_rows enable row level security;
alter table public.code_vault_private_rows force row level security;
alter table public.code_vault_access_events enable row level security;
alter table public.code_vault_access_events force row level security;

revoke all on table public.code_vault_assignments from public, anon, authenticated;
revoke all on table public.code_vault_private_rows from public, anon, authenticated;
revoke all on table public.code_vault_access_events from public, anon, authenticated;
revoke all on function public.code_vault_set_updated_at() from public, anon, authenticated;
revoke all on function public.code_vault_assignment_insert_guard() from public, anon, authenticated;
revoke all on function public.code_vault_assignment_guard() from public, anon, authenticated;
revoke all on function public.code_vault_private_row_guard() from public, anon, authenticated;
revoke all on function public.code_vault_access_events_append_only() from public, anon, authenticated;

grant select, insert, update on table public.code_vault_assignments to service_role;
grant select, insert, update on table public.code_vault_private_rows to service_role;
grant select, insert on table public.code_vault_access_events to service_role;

comment on table public.code_vault_assignments is
  'Attribution de code (ENT, cantine, Koxo) : identité, cycle de vie et autorisation. Ne porte jamais la valeur du code.';
comment on table public.code_vault_private_rows is
  'Valeur de code chiffrée au repos (AES-256-GCM), sur le motif de identity_directory_private_rows. Jamais de colonne en clair.';
comment on table public.code_vault_access_events is
  'Journal d''accès au coffre. Ne porte jamais de valeur ni de fragment de valeur, seulement le fait consulté et, en cas de refus, le motif.';
comment on column public.code_vault_private_rows.ciphertext is
  'AES-256-GCM ciphertext bound to institution and assignment. Bounded to 512 chars: a single access code, never a larger payload.';

commit;
