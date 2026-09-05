begin;

-- LOT 2 (plan de publication flash, 2026-09-05, T071F) : une version
-- 'validee' mais jamais publiee avant `expires_at` ne peut plus jamais etre
-- publiee (la route de publication du LOT 1 refuse deja une information
-- perimee). Sans nouvel etat elle resterait 'validee' pour toujours et
-- serait redetectee a l'identique a chaque passage du balayage d'expiration,
-- produisant un avis dupplique a chaque execution. Ce nouvel etat terminal,
-- symetrique de 'expiree_sans_validation' (LOT 5 du plan de persistance),
-- la sort proprement du balayage des qu'elle a ete traitee une fois.
--
-- Seul le check de colonne `status` doit etre etendu (nom auto-genere
-- deterministe : <table>_<colonne>_check pour un check attache a une seule
-- colonne — meme convention verifiee sur ce depot par
-- identity_directory_imports_status_check, knowledge_documents_status_check,
-- support_attachments_scan_status_check, site_content_assets_status_check et
-- communication_deliveries_status_check, tous des checks de colonne unique
-- deja recrees a l'identique dans des migrations anterieures). Les checks de
-- table qui enumerent des statuts (validated_at requis, validated_by /
-- validated_at interdits) restent vrais par vacuite pour ce nouveau statut :
-- aucun n'interdit rien qu'il ne faudrait interdire, donc aucun n'a besoin
-- d'etre touche. Cette lecture est prouvee par relecture du texte SQL, pas
-- par execution : Docker Desktop est indisponible ce soir (CLAUDE.md, "Docker
-- manquant se dit, ne se contourne pas") ; a rejouer en base reelle au LOT 4.
alter table public.flash_info_versions
  drop constraint if exists flash_info_versions_status_check,
  add constraint flash_info_versions_status_check check (
    status in (
      'proposee', 'validee', 'publiee', 'modifiee',
      'expiree_sans_validation', 'expiree_sans_publication', 'refusee'
    )
  );

-- Meme forme que l'index partiel existant sur 'proposee'
-- (flash_info_versions_expiration_pending_idx) : le balayage d'expiration
-- doit pouvoir lire les versions 'validee' en attente de publication sans
-- scan complet de la table.
create index flash_info_versions_validee_expiration_pending_idx
  on public.flash_info_versions (expires_at)
  where status = 'validee';

-- Le trigger doit accepter la nouvelle transition legale validee ->
-- expiree_sans_publication, au meme titre que validee -> publiee.
create or replace function public.flash_guard_version()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.institution_id <> old.institution_id
    or new.flash_info_id <> old.flash_info_id
    or new.version <> old.version
    or new.previous_version_id is distinct from old.previous_version_id
    or new.proposed_by <> old.proposed_by
    or new.created_at <> old.created_at then
    raise exception 'Flash info version scope is immutable';
  end if;

  if old.status = new.status then
    return new;
  end if;

  if not (
    (old.status = 'proposee' and new.status in ('validee', 'refusee', 'expiree_sans_validation'))
    or (old.status = 'validee' and new.status in ('publiee', 'expiree_sans_publication'))
    or (old.status = 'publiee' and new.status = 'modifiee')
  ) then
    raise exception 'invalid_flash_info_version_transition';
  end if;
  return new;
end;
$$;

comment on column public.flash_info_versions.status is
  'expiree_sans_publication (LOT 2 du plan de publication, T071F) : validee mais jamais publiee avant expires_at ; etat terminal symetrique de expiree_sans_validation, atteint uniquement depuis validee.';

commit;
