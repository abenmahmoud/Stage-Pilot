begin;

-- LOT 1 (plan de publication flash, 2026-09-05) : la transition validee ->
-- publiee doit enregistrer QUI publie, distinctement de QUI a valide
-- (validated_by/validated_at, deja porte par la migration LOT 1 de
-- persistance). Meme motif, meme forme.
alter table public.flash_info_versions
  add column published_by uuid references auth.users(id) on delete restrict;

alter table public.flash_info_versions
  add constraint flash_info_versions_published_by_at_check
  check ((published_by is null) = (published_at is null));

alter table public.flash_info_versions
  add constraint flash_info_versions_publiee_published_by_check
  check (status <> 'publiee' or published_by is not null);

-- La garde d'insertion doit refuser published_by au meme titre que
-- published_at : une version nait toujours "proposee", jamais deja publiee.
create or replace function public.flash_info_version_insert_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status <> 'proposee'
    or new.validated_by is not null
    or new.validated_at is not null
    or new.published_at is not null
    or new.published_by is not null
    or new.superseded_at is not null then
    raise exception 'flash_info_version_must_start_proposee';
  end if;
  return new;
end;
$$;

comment on column public.flash_info_versions.published_by is
  'Qui a publie cette version (validee -> publiee), distinct de validated_by : valider et publier sont deux gestes humains distincts (decision d''Adel, plan de publication du 5 septembre 2026).';

commit;
