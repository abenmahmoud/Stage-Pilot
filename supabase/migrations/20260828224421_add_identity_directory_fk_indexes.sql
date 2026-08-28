begin;

create index identity_directory_imports_uploaded_by_idx
  on public.identity_directory_imports (uploaded_by);
create index identity_directory_imports_approved_by_idx
  on public.identity_directory_imports (approved_by)
  where approved_by is not null;
create index identity_directory_rows_import_institution_idx
  on public.identity_directory_rows (import_id, institution_id);

commit;
