-- RLS, helpers and triggers recovered from the Supabase migration journal.
alter table public.eleves enable row level security;
alter table public.stages enable row level security;
alter table public.fiches_grand_oral enable row level security;
alter table public.classes enable row level security;
alter table public.professeurs enable row level security;
alter table public.etablissement enable row level security;
alter table public.templates_documents enable row level security;
alter table public.import_logs enable row level security;
alter table public.notifications_log enable row level security;

create or replace function public.get_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (auth.jwt() -> 'app_metadata' ->> 'role'),
    'anonymous'
  );
$$;

create policy "eleve_self" on public.eleves
  for all
  using (auth_user_id = auth.uid() and get_role() = 'eleve')
  with check (auth_user_id = auth.uid() and get_role() = 'eleve');

create policy "pp_prof_classe_eleves" on public.eleves
  for select
  using (
    get_role() in ('pp', 'professeur')
    and exists (
      select 1 from public.classes c
      where c.id = eleves.classe_id
        and c.professeur_principal_id = auth.uid()
    )
  );

create policy "admin_all_eleves" on public.eleves
  for all
  using (get_role() in ('administration', 'proviseur', 'superadmin'))
  with check (get_role() in ('administration', 'proviseur', 'superadmin'));

create policy "eleve_son_stage" on public.stages
  for all
  using (
    get_role() = 'eleve'
    and exists (
      select 1 from public.eleves e
      where e.id = stages.eleve_id and e.auth_user_id = auth.uid()
    )
  )
  with check (
    get_role() = 'eleve'
    and exists (
      select 1 from public.eleves e
      where e.id = stages.eleve_id and e.auth_user_id = auth.uid()
    )
  );

create policy "pp_classe_stages" on public.stages
  for select
  using (
    get_role() in ('pp', 'professeur')
    and exists (
      select 1
      from public.eleves e
      join public.classes c on c.id = e.classe_id
      where e.id = stages.eleve_id
        and c.professeur_principal_id = auth.uid()
    )
  );

create policy "referent_ses_stages" on public.stages
  for all
  using (get_role() = 'professeur' and stages.professeur_referent_id = auth.uid())
  with check (get_role() = 'professeur' and stages.professeur_referent_id = auth.uid());

create policy "admin_all_stages" on public.stages
  for all
  using (get_role() in ('administration', 'proviseur', 'superadmin'))
  with check (get_role() in ('administration', 'proviseur', 'superadmin'));

create policy "eleve_sa_fiche_go" on public.fiches_grand_oral
  for all
  using (
    get_role() = 'eleve'
    and exists (
      select 1 from public.eleves e
      where e.id = fiches_grand_oral.eleve_id
        and e.auth_user_id = auth.uid()
    )
  )
  with check (
    get_role() = 'eleve'
    and exists (
      select 1 from public.eleves e
      where e.id = fiches_grand_oral.eleve_id
        and e.auth_user_id = auth.uid()
    )
  );

create policy "prof_ses_fiches_go" on public.fiches_grand_oral
  for all
  using (
    get_role() = 'professeur'
    and (
      fiches_grand_oral.prof_spe1_id = auth.uid()
      or fiches_grand_oral.prof_spe2_id = auth.uid()
    )
  )
  with check (
    get_role() = 'professeur'
    and (
      fiches_grand_oral.prof_spe1_id = auth.uid()
      or fiches_grand_oral.prof_spe2_id = auth.uid()
    )
  );

create policy "admin_all_go" on public.fiches_grand_oral
  for all
  using (get_role() in ('administration', 'proviseur', 'superadmin'))
  with check (get_role() in ('administration', 'proviseur', 'superadmin'));

create policy "tous_lisent_classes" on public.classes
  for select using (auth.uid() is not null);
create policy "admin_edite_classes" on public.classes
  for all
  using (get_role() in ('administration', 'superadmin'))
  with check (get_role() in ('administration', 'superadmin'));

create policy "tous_lisent_professeurs" on public.professeurs
  for select using (auth.uid() is not null);
create policy "admin_edite_professeurs" on public.professeurs
  for all
  using (get_role() in ('administration', 'superadmin'))
  with check (get_role() in ('administration', 'superadmin'));

create policy "tous_lisent_etablissement" on public.etablissement
  for select using (auth.uid() is not null);
create policy "admin_edite_etablissement" on public.etablissement
  for all
  using (get_role() in ('administration', 'superadmin'))
  with check (get_role() in ('administration', 'superadmin'));

create policy "tous_lisent_templates" on public.templates_documents
  for select using (auth.uid() is not null);
create policy "superadmin_edite_templates" on public.templates_documents
  for all
  using (get_role() = 'superadmin')
  with check (get_role() = 'superadmin');

create policy "admin_lit_import_logs" on public.import_logs
  for select using (get_role() in ('administration', 'superadmin'));
create policy "admin_lit_notif_logs" on public.notifications_log
  for select using (get_role() in ('administration', 'superadmin'));

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger t_stages_upd
  before update on public.stages
  for each row execute function public.set_updated_at();
create trigger t_fiches_upd
  before update on public.fiches_grand_oral
  for each row execute function public.set_updated_at();
create trigger t_eleves_upd
  before update on public.eleves
  for each row execute function public.set_updated_at();
create trigger t_templates_upd
  before update on public.templates_documents
  for each row execute function public.set_updated_at();
create trigger t_etablissement_upd
  before update on public.etablissement
  for each row execute function public.set_updated_at();

create index idx_eleves_auth_user_id on public.eleves (auth_user_id);
create index idx_professeurs_auth_user_id on public.professeurs (auth_user_id);
create index idx_classes_pp_id on public.classes (professeur_principal_id);
