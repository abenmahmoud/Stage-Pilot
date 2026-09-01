begin;

insert into public.site_content_assets (
  id, storage_path, original_name, mime_type, size_bytes, asset_kind, title
) values (
  '99999999-9999-4999-8999-999999999991',
  'fictif/antivirus/test.pdf',
  'test-fictif.pdf',
  'application/pdf',
  5,
  'document',
  'Test fictif'
);

do $$
begin
  begin
    update public.site_content_assets
    set storage_bucket = 'site-content', status = 'ready'
    where id = '99999999-9999-4999-8999-999999999991';
    raise exception 'unsafe_ready_was_accepted';
  exception
    when others then
      if sqlerrm = 'unsafe_ready_was_accepted' then
        raise;
      end if;
  end;
end;
$$;

update public.site_content_assets
set status = 'quarantine',
    scan_detail = 'awaiting_antivirus',
    sha256 = repeat('a', 64)
where id = '99999999-9999-4999-8999-999999999991';

update public.site_content_assets
set storage_bucket = 'site-content',
    status = 'ready',
    scan_detail = 'clamav_clean',
    scanned_at = now()
where id = '99999999-9999-4999-8999-999999999991';

insert into public.site_content_audit (
  resource_type, resource_id, action, summary
) values (
  'asset',
  '99999999-9999-4999-8999-999999999991',
  'scan_clean',
  '{"fictitious":true}'::jsonb
);

select pgmq.send(
  'site_content_file_scan',
  jsonb_build_object(
    'job_id', '99999999-9999-4999-8999-999999999992',
    'job_type', 'scan_site_content_asset',
    'asset_id', '99999999-9999-4999-8999-999999999991'
  )
);

select status, storage_bucket, scan_detail
from public.site_content_assets
where id = '99999999-9999-4999-8999-999999999991';

rollback;
