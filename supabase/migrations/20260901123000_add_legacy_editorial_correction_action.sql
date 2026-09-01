begin;

alter table public.site_content_audit
  drop constraint if exists site_content_audit_action_check;

alter table public.site_content_audit
  add constraint site_content_audit_action_check check (
    action in (
      'create', 'update', 'submit_review', 'publish', 'archive', 'duplicate',
      'restore', 'upload', 'reserve_upload', 'confirm_upload', 'reject_upload',
      'scan_clean', 'scan_blocked', 'scan_error', 'legacy_import', 'verify_source',
      'apply_editorial_corrections'
    )
  );

commit;
