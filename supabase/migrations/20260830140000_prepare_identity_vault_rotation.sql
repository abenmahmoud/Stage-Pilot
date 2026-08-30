begin;

create index if not exists identity_directory_private_rows_rotation_idx
  on public.identity_directory_private_rows (
    institution_id,
    import_id,
    key_version,
    id
  );

alter table public.identity_directory_audit
  drop constraint if exists identity_directory_audit_action_check;

alter table public.identity_directory_audit
  add constraint identity_directory_audit_action_check check (
    action in (
      'reserve_upload', 'confirm_upload', 'reject_upload', 'queue_scan',
      'complete_parse', 'approve', 'activate', 'supersede', 'retire', 'revoke',
      'verify_contact', 'link_identity', 'link_relationship',
      'request_lookup', 'complete_lookup', 'read_lookup', 'expire_lookup',
      'rotate_vault_batch'
    )
  );

comment on index public.identity_directory_private_rows_rotation_idx is
  'Supports one-import-at-a-time application key rotation without exposing payloads.';

commit;
