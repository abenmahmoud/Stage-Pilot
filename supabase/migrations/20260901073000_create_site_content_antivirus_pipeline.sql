begin;

select pgmq.create('site_content_file_scan');

alter table public.site_content_assets
  add column scan_detail text,
  add column sha256 text,
  add column scanned_at timestamptz;

alter table public.site_content_assets
  drop constraint site_content_assets_storage_bucket_check,
  drop constraint site_content_assets_status_check;

alter table public.site_content_assets
  alter column storage_bucket set default 'site-content-quarantine';

alter table public.site_content_assets
  add constraint site_content_assets_storage_bucket_check check (
    storage_bucket in ('site-content-quarantine', 'site-content')
  ),
  add constraint site_content_assets_status_check check (
    status in ('pending', 'quarantine', 'ready', 'blocked', 'scan_error', 'archived')
  ),
  add constraint site_content_assets_scan_detail_check check (
    scan_detail is null or char_length(scan_detail) between 1 and 120
  ),
  add constraint site_content_assets_sha256_check check (
    sha256 is null or sha256 ~ '^[0-9a-f]{64}$'
  ),
  add constraint site_content_assets_scan_state_check check (
    (status = 'pending'
      and storage_bucket = 'site-content-quarantine'
      and scan_detail is null
      and sha256 is null
      and scanned_at is null)
    or (status = 'quarantine'
      and storage_bucket = 'site-content-quarantine'
      and scan_detail = 'awaiting_antivirus'
      and sha256 is not null
      and scanned_at is null)
    or (status = 'ready'
      and storage_bucket = 'site-content'
      and (
        (scan_detail = 'clamav_clean' and sha256 is not null and scanned_at is not null)
        or (
          source_system = 'wordpress'
          and scan_detail is null
          and sha256 is null
          and scanned_at is null
        )
      ))
    or status in ('blocked', 'scan_error', 'archived')
  );

create or replace function public.enforce_site_content_asset_status_transition()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.status = 'ready' and old.status <> 'ready' and not (
    new.storage_bucket = 'site-content'
    and new.scan_detail = 'clamav_clean'
    and new.sha256 is not null
    and new.scanned_at is not null
  ) then
    raise exception 'site_content_asset_clean_proof_required';
  end if;
  if old.status = new.status then
    return new;
  end if;
  if not (
    (old.status = 'pending' and new.status in ('quarantine', 'blocked', 'scan_error', 'archived'))
    or (old.status = 'quarantine' and new.status in ('ready', 'blocked', 'scan_error', 'archived'))
    or (old.status = 'scan_error' and new.status in ('quarantine', 'blocked', 'archived'))
    or (old.status = 'ready' and new.status = 'archived')
    or (
      old.status = 'ready'
      and old.source_system = 'wordpress'
      and old.scan_detail is null
      and new.status = 'quarantine'
    )
    or (old.status = 'blocked' and new.status = 'archived')
  ) then
    raise exception 'invalid_site_content_asset_status_transition';
  end if;
  return new;
end;
$$;

create trigger site_content_assets_status_transition
before update of status on public.site_content_assets
for each row execute function public.enforce_site_content_asset_status_transition();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'site-content-quarantine',
  'site-content-quarantine',
  false,
  10485760,
  array[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

alter table public.site_content_audit
  drop constraint site_content_audit_action_check;

alter table public.site_content_audit
  add constraint site_content_audit_action_check check (
    action in (
      'create', 'update', 'submit_review', 'publish', 'archive', 'duplicate',
      'restore', 'upload', 'reserve_upload', 'confirm_upload', 'reject_upload',
      'scan_clean', 'scan_blocked', 'scan_error', 'legacy_import', 'verify_source'
    )
  );

comment on column public.site_content_assets.scan_detail is
  'Bounded machine status only; never stores a filename, document text or antivirus output.';
comment on column public.site_content_assets.sha256 is
  'Server-calculated digest used to bind the quarantine object to the scan job.';
comment on table public.site_content_assets is
  'New assets require a clean scan proof. Existing WordPress rows are grandfathered only until the dedicated backfill is explicitly authorized.';

commit;
