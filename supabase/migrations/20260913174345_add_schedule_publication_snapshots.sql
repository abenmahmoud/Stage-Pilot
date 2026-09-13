begin;

-- An original upload keeps its pending calendars. Publications are immutable
-- subsets, with their own private copy of the same scanned evidence.
alter table public.schedule_source_versions
  add column origin_source_id uuid,
  add constraint schedule_publication_origin_fk foreign key (origin_source_id,institution_id)
    references public.schedule_source_versions(id,institution_id) on delete restrict,
  add constraint schedule_publication_not_self check (origin_source_id is null or origin_source_id <> id);
create index schedule_publication_origin_idx on public.schedule_source_versions(origin_source_id,institution_id)
  where origin_source_id is not null;

drop index public.schedule_source_versions_checksum_uidx;
create unique index schedule_source_versions_checksum_uidx
  on public.schedule_source_versions(institution_id,source_kind,school_year,checksum)
  where checksum is not null and origin_source_id is null and status not in ('rejected','failed','retired');

create function public.schedule_validate_publication_origin() returns trigger
language plpgsql security invoker set search_path='' as $$
declare original public.schedule_source_versions%rowtype;
begin
  if tg_op='UPDATE' then
    if new.origin_source_id is distinct from old.origin_source_id then
      raise exception 'Schedule publication origin is immutable';
    end if;
    if old.origin_source_id is not null and
      row(new.institution_id,new.source_kind,new.source_format,new.school_year,new.checksum,new.storage_path,new.storage_bucket,
        new.size_bytes,new.mime_type,new.effective_from,new.effective_until,new.fresh_until,new.page_count,new.validation_summary)
      is distinct from
      row(old.institution_id,old.source_kind,old.source_format,old.school_year,old.checksum,old.storage_path,old.storage_bucket,
        old.size_bytes,old.mime_type,old.effective_from,old.effective_until,old.fresh_until,old.page_count,old.validation_summary) then
      raise exception 'Schedule publication evidence is immutable';
    end if;
    return new;
  end if;
  if new.origin_source_id is null then return new; end if;
  select * into original from public.schedule_source_versions
    where id=new.origin_source_id and institution_id=new.institution_id for key share;
  if not found or original.origin_source_id is not null or original.status<>'review'
    or original.source_format<>'ical_import' or new.status<>'review'
    or original.checksum is null or (original.validation_summary->>'securityScan') is distinct from 'clean'
    or row(new.source_kind,new.source_format,new.school_year,new.checksum,new.storage_bucket,new.size_bytes,new.mime_type,new.effective_from,new.effective_until,new.fresh_until)
       is distinct from row(original.source_kind,original.source_format,original.school_year,original.checksum,original.storage_bucket,original.size_bytes,original.mime_type,original.effective_from,original.effective_until,original.fresh_until)
    or new.storage_path=original.storage_path or new.page_count is null or new.page_count>original.page_count
    or (new.validation_summary->>'publicationOriginId') is distinct from new.origin_source_id::text then
    raise exception 'Invalid schedule publication evidence';
  end if;
  return new;
end;
$$;
revoke all on function public.schedule_validate_publication_origin() from public,anon,authenticated;
grant execute on function public.schedule_validate_publication_origin() to service_role;
create trigger schedule_validate_publication_origin before insert or update on public.schedule_source_versions
  for each row execute function public.schedule_validate_publication_origin();

commit;
