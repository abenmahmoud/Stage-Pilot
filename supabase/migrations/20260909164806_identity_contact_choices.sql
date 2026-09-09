-- A keyed surname index, not plaintext names; the vault still owns all contacts.
alter table public.identity_directory_rows add column name_lookup_hash text
  check (name_lookup_hash is null or name_lookup_hash ~ '^[a-f0-9]{64}$');
create index identity_directory_rows_name_lookup_idx
  on public.identity_directory_rows (institution_id, import_id, person_type, name_lookup_hash)
  where record_type = 'person';
alter table public.identity_directory_lookup_requests
  drop constraint identity_directory_lookup_requests_search_type_check,
  add constraint identity_directory_lookup_requests_search_type_check check (
    search_type in ('academic_email', 'personal_email', 'email', 'phone', 'person_ref', 'identity')
  );
-- Keep the existing private API boundary (no client access, including hashes).
alter table public.identity_directory_rows enable row level security;
revoke all on public.identity_directory_rows from anon, authenticated;
comment on column public.identity_directory_rows.name_lookup_hash is
  'HMAC of normalized surname, populated only by the private directory worker.';
