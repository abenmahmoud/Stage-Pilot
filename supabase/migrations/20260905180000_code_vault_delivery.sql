begin;

-- LOT 3 du plan du coffre de codes (2026-09-05) : attribution et remise.
-- Ajoute les colonnes opérationnelles nécessaires au quota d'affichage
-- quotidien, à la fenêtre de visibilité de 30 minutes et au signalement
-- défectueux tracé. Aucune de ces colonnes ne peut porter une valeur de
-- code : la valeur reste exclusivement dans `code_vault_private_rows`
-- (LOT 2). Le statut du cycle de vie (LOT 1/2) n'est pas touché : ni
-- l'expiration, ni le signalement défectueux, ni un remplacement humain ne
-- font régresser `status` — un remplacement crée une nouvelle version de
-- l'attribution (nouveau quadruplet), il ne réutilise jamais l'ancienne.

alter table public.code_vault_assignments
  add column revealed_at timestamptz,
  add column display_count integer not null default 0,
  add column display_count_date date,
  add column defective_flagged_at timestamptz,
  add column defective_reason text,
  add column defective_flagged_by text,
  add column replaced_by_assignment_id uuid;

alter table public.code_vault_assignments
  add constraint code_vault_assignments_display_count_bounds
    check (display_count between 0 and 1000),
  add constraint code_vault_assignments_defect_report_consistency
    check (
      (defective_flagged_at is null) = (defective_reason is null)
      and (defective_flagged_at is null) = (defective_flagged_by is null)
    ),
  add constraint code_vault_assignments_defect_reason_bounds
    check (defective_reason is null or length(btrim(defective_reason)) between 3 and 500),
  add constraint code_vault_assignments_defect_flagged_by_bounds
    check (
      defective_flagged_by is null
      or length(btrim(defective_flagged_by)) between 3 and 120
    ),
  add constraint code_vault_assignments_replacement_not_self
    check (replaced_by_assignment_id is distinct from id),
  add constraint code_vault_assignments_replacement_fk
    foreign key (replaced_by_assignment_id, institution_id)
    references public.code_vault_assignments (id, institution_id) on delete restrict;

create index code_vault_assignments_display_window_idx
  on public.code_vault_assignments (institution_id, display_count_date);

-- Le déclencheur du LOT 2 protégeait déjà l'identité du quadruplet et la
-- progression légale du statut. On y ajoute deux immutabilités : un
-- signalement défectueux et une trace de remplacement, une fois posés, ne
-- peuvent plus changer. La garantie tient par la contrainte, pas par la
-- discipline de l'appelant : « aucun remplacement ni réactivation
-- automatique » (plan §LOT 3) n'a ainsi aucun chemin possible en écriture,
-- même par erreur applicative.
create or replace function public.code_vault_assignment_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.institution_id <> old.institution_id
    or new.person_ref <> old.person_ref
    or new.service <> old.service
    or new.school_year <> old.school_year
    or new.version <> old.version
    or new.created_at <> old.created_at then
    raise exception 'code_vault_assignment_identity_is_immutable';
  end if;

  if old.defective_flagged_at is not null and (
    new.defective_flagged_at is distinct from old.defective_flagged_at
    or new.defective_reason is distinct from old.defective_reason
    or new.defective_flagged_by is distinct from old.defective_flagged_by
  ) then
    raise exception 'code_vault_assignment_defect_flag_is_immutable';
  end if;
  if old.replaced_by_assignment_id is not null
    and new.replaced_by_assignment_id is distinct from old.replaced_by_assignment_id then
    raise exception 'code_vault_assignment_replacement_trace_is_immutable';
  end if;

  if old.status = new.status then
    return new;
  end if;

  if not (
    (old.status = 'disponible' and new.status = 'reserve')
    or (old.status = 'reserve' and new.status = 'remis')
    or (old.status = 'remis' and new.status = 'utilise')
  ) then
    raise exception 'invalid_code_vault_assignment_transition';
  end if;
  return new;
end;
$$;

comment on column public.code_vault_assignments.revealed_at is
  'Horodatage de la dernière remise visible du code. Fenêtre de visibilité de 30 minutes (shared/code-vault-policy.ts VAULT_DISPLAY_VISIBILITY_SECONDS) ; passé ce délai, une nouvelle vérification d''identité est requise avant toute nouvelle remise.';
comment on column public.code_vault_assignments.display_count is
  'Nombre d''affichages pour le jour de display_count_date. Au-delà de VAULT_MAX_DAILY_DISPLAYS (3, shared/code-vault-policy.ts), le formulaire enrichi prend le relais.';
comment on column public.code_vault_assignments.defective_flagged_at is
  'Signalement défectueux : attend une intervention humaine. Aucun remplacement ni réactivation automatique. Immuable une fois posé (déclencheur).';
comment on column public.code_vault_assignments.replaced_by_assignment_id is
  'Trace d''un remplacement humain (ex. code cantine fixe remplacé après intervention) vers la nouvelle version de l''attribution. Immuable une fois posé (déclencheur).';

commit;
