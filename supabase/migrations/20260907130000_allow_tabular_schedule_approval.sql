begin;

-- LOT 4 du plan `docs/operations/PLAN_IMPORT_UTILISABLE_2026-09-07.md` :
-- la recette de bout en bout (dépôt tabulaire -> correspondance -> écriture
-- -> approbation -> activation) a révélé qu'aucun import tabulaire ne peut
-- jamais être approuvé. `schedule_validate_source_promotion()`
-- (`20260901101500_add_schedule_retirement_governance.sql`) exige, pour
-- passer en `approved`/`active`/`superseded`, que `validation_summary`
-- porte `pageCountVerified = 'true'` et `pageAssetsVerified = 'true'`, et
-- qu'une image de page privée (`schedule_page_assets`) existe pour chaque
-- page — deux notions propres au pipeline PDF (page scannée, comptage de
-- pages par OCR) qui n'ont pas d'équivalent pour un fichier tabulaire : la
-- correspondance de colonnes du LOT 3 ne produit ni image de page ni
-- comptage OCR, et ne renseigne jamais ces deux clés.
--
-- Cette fonction n'avait pas été mise à jour par le LOT 3
-- (`20260907120000_add_schedule_tabular_import_format.sql`), qui n'allait
-- jamais jusqu'à l'approbation. Correctif minimal : pour
-- `source_format = 'tabular_import'`, seul `securityScan = 'clean'` est
-- exigé, et aucune image de page n'est requise. Le pipeline PDF n'est pas
-- modifié.

create or replace function public.schedule_validate_source_promotion()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  mapped_pages integer;
  verified_pages integer;
  generated_pages integer;
begin
  if old.status = new.status then
    return new;
  end if;

  if old.status = 'retired' then
    raise exception 'A retired schedule source cannot be reactivated';
  end if;
  if new.status = 'approved' and old.status <> 'review' then
    raise exception 'Schedule approval requires human review';
  end if;
  if new.status = 'active' and old.status not in ('approved', 'superseded') then
    raise exception 'Schedule activation requires approval or rollback';
  end if;
  if new.status = 'superseded' and old.status <> 'active' then
    raise exception 'Only an active schedule can be superseded';
  end if;
  if new.status = 'retired' then
    if old.status not in ('review', 'approved', 'superseded', 'rejected', 'failed') then
      raise exception 'This schedule source cannot be retired from its current state';
    end if;
    if new.retired_by is null
      or new.retired_at is null
      or length(btrim(new.retirement_reason)) not between 20 and 1000
      or new.retention_policy_key <> 'pending_dpo'
      or new.retention_until is not null
      or new.storage_purge_status <> 'blocked'
      or new.purged_at is not null
    then
      raise exception 'Schedule retirement governance is incomplete';
    end if;
  end if;

  if new.status in ('approved', 'active', 'superseded') then
    if new.checksum is null
      or new.page_count is null
      or (new.validation_summary ->> 'securityScan') is distinct from 'clean'
    then
      raise exception 'Schedule document validation is incomplete';
    end if;

    if new.source_format = 'pdf_import'
      and (
        (new.validation_summary ->> 'pageCountVerified') is distinct from 'true'
        or (new.validation_summary ->> 'pageAssetsVerified') is distinct from 'true'
      )
    then
      raise exception 'Schedule document validation is incomplete';
    end if;

    select
      count(*)::integer,
      count(*) filter (where review_status = 'verified')::integer
    into mapped_pages, verified_pages
    from public.schedule_page_indexes
    where source_version_id = new.id
      and institution_id = new.institution_id;

    if mapped_pages <> new.page_count or verified_pages <> new.page_count then
      raise exception 'Every schedule page must be mapped and verified';
    end if;

    if new.source_format = 'pdf_import' then
      select count(*)::integer
      into generated_pages
      from public.schedule_page_assets
      where source_version_id = new.id
        and institution_id = new.institution_id;

      if generated_pages <> new.page_count then
        raise exception 'Every schedule page must have a private page asset';
      end if;
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.schedule_validate_source_promotion()
from public, anon, authenticated;
grant execute on function public.schedule_validate_source_promotion()
to service_role;

commit;
