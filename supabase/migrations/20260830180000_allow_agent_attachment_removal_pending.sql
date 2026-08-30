begin;

alter table public.support_attachments
  drop constraint if exists support_attachments_scan_status_check,
  add constraint support_attachments_scan_status_check check (
    scan_status in (
      'awaiting_upload',
      'quarantine',
      'clean',
      'blocked',
      'scan_error',
      'removal_pending'
    )
  );

commit;
