begin;

-- LOT 1 du plan de connaissance OB1 (2026-09-05) : ajoute la provenance et la
-- politique d'usage a `knowledge_sources`, sans toucher a une ligne
-- existante. Les valeurs par defaut ('imported' / 'can_use_as_instruction')
-- preservent exactement le comportement actuel : toute source deja en base
-- reste utilisable comme instruction, comme avant cette migration.

alter table public.knowledge_sources
  add column provenance_status text not null default 'imported' check (
    provenance_status in (
      'observed', 'inferred', 'user_confirmed', 'imported', 'generated',
      'superseded', 'disputed'
    )
  ),
  add column use_policy text not null default 'can_use_as_instruction' check (
    use_policy in (
      'can_use_as_instruction', 'can_use_as_evidence',
      'requires_human_confirmation', 'do_not_inject_automatically'
    )
  ),
  add column superseded_by uuid,
  add column review_comment text check (
    review_comment is null or length(btrim(review_comment)) between 3 and 2000
  ),
  add column reviewed_by uuid references auth.users(id) on delete restrict,
  add column reviewed_at timestamptz;

alter table public.knowledge_sources
  add constraint knowledge_sources_superseded_by_fk
    foreign key (superseded_by, institution_id)
    references public.knowledge_sources(id, institution_id)
    on delete restrict,
  add constraint knowledge_sources_superseded_by_not_self_check check (
    superseded_by is null or superseded_by <> id
  ),
  -- Une source superseded DOIT porter un remplacement ; une source qui n'est
  -- pas superseded ne PEUT PAS en porter un (regle du plan, §LOT1).
  add constraint knowledge_sources_superseded_pairing_check check (
    (provenance_status = 'superseded') = (superseded_by is not null)
  ),
  -- Une source generated/inferred ne peut jamais servir de consigne : garanti
  -- par la contrainte, pas par la discipline de l'appelant (regle 2 rendue
  -- structurelle, §LOT1).
  add constraint knowledge_sources_generated_inferred_policy_check check (
    provenance_status not in ('generated', 'inferred')
    or use_policy <> 'can_use_as_instruction'
  ),
  add constraint knowledge_sources_review_pairing_check check (
    (reviewed_by is null and reviewed_at is null)
    or (reviewed_by is not null and reviewed_at is not null)
  );

create index knowledge_sources_provenance_status_idx
  on public.knowledge_sources (institution_id, provenance_status);
create index knowledge_sources_use_policy_idx
  on public.knowledge_sources (institution_id, use_policy);
create index knowledge_sources_superseded_by_idx
  on public.knowledge_sources (superseded_by)
  where superseded_by is not null;
create index knowledge_sources_reviewed_by_idx
  on public.knowledge_sources (reviewed_by)
  where reviewed_by is not null;

-- Une fois pose, `superseded_by` est immuable (meme principe que le coffre de
-- codes, `code_vault_private_row_guard`) : une ligne ne peut jamais changer de
-- remplacement apres coup, seulement passer de null a une valeur posee une
-- bonne fois. Combine a la contrainte de pairing ci-dessus, cela empeche
-- egalement de faire sortir une ligne de l'etat `superseded` une fois que
-- `superseded_by` est pose, sans avoir a dupliquer la regle ici.
create or replace function public.knowledge_sources_supersede_guard()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if old.superseded_by is not null
    and new.superseded_by is distinct from old.superseded_by then
    raise exception 'knowledge_sources_superseded_by_is_immutable';
  end if;
  return new;
end;
$$;

create trigger knowledge_sources_supersede_guard_trigger
before update on public.knowledge_sources
for each row execute function public.knowledge_sources_supersede_guard();

revoke all on function public.knowledge_sources_supersede_guard()
from public, anon, authenticated;
grant execute on function public.knowledge_sources_supersede_guard() to service_role;

comment on column public.knowledge_sources.provenance_status is
  'Origine de la source : observed, inferred, user_confirmed, imported (defaut, comportement historique preserve), generated, superseded, disputed.';
comment on column public.knowledge_sources.use_policy is
  'Usage autorise pour l''agent : can_use_as_instruction (defaut, comportement historique preserve), can_use_as_evidence, requires_human_confirmation, do_not_inject_automatically.';
comment on column public.knowledge_sources.superseded_by is
  'Source de remplacement quand provenance_status = superseded. Immuable une fois posee (knowledge_sources_supersede_guard_trigger).';
comment on column public.knowledge_sources.review_comment is
  'Commentaire de relecture humaine, borne en longueur (3 a 2000 caracteres).';

commit;

-- ---------------------------------------------------------------------------
-- Migration inverse (non appliquee automatiquement ; le depot n'a pas de
-- convention de fichier `down`, cf. les migrations precedentes du meme
-- dossier). A rejouer manuellement sur une pile jetable si LOT 1 doit etre
-- annule avant que LOT 2 et suivants ne s'appuient dessus :
--
-- begin;
-- drop trigger if exists knowledge_sources_supersede_guard_trigger on public.knowledge_sources;
-- drop function if exists public.knowledge_sources_supersede_guard();
-- drop index if exists public.knowledge_sources_reviewed_by_idx;
-- drop index if exists public.knowledge_sources_superseded_by_idx;
-- drop index if exists public.knowledge_sources_use_policy_idx;
-- drop index if exists public.knowledge_sources_provenance_status_idx;
-- alter table public.knowledge_sources
--   drop constraint if exists knowledge_sources_review_pairing_check,
--   drop constraint if exists knowledge_sources_generated_inferred_policy_check,
--   drop constraint if exists knowledge_sources_superseded_pairing_check,
--   drop constraint if exists knowledge_sources_superseded_by_not_self_check,
--   drop constraint if exists knowledge_sources_superseded_by_fk;
-- alter table public.knowledge_sources
--   drop column if exists reviewed_at,
--   drop column if exists reviewed_by,
--   drop column if exists review_comment,
--   drop column if exists superseded_by,
--   drop column if exists use_policy,
--   drop column if exists provenance_status;
-- commit;
