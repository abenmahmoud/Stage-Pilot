begin;

-- The role helper only reads the caller JWT. It does not need owner privileges.
alter function public.get_role() security invoker;
alter function public.get_role() set search_path = pg_catalog;
revoke all on function public.get_role() from public, anon;
grant execute on function public.get_role() to authenticated, service_role;

-- Keep the shared update trigger deterministic and immune to search-path changes.
alter function public.set_updated_at() set search_path = pg_catalog;

-- Scope the legacy LyceeGest policies to signed-in users and evaluate stable
-- identity helpers once per statement instead of once per candidate row.
alter policy admin_edite_classes on public.classes
  to authenticated
  using ((select public.get_role()) = any (array['administration'::text, 'superadmin'::text]))
  with check ((select public.get_role()) = any (array['administration'::text, 'superadmin'::text]));

alter policy tous_lisent_classes on public.classes
  to authenticated
  using ((select auth.uid()) is not null);

alter policy admin_all_eleves on public.eleves
  to authenticated
  using ((select public.get_role()) = any (array['administration'::text, 'proviseur'::text, 'superadmin'::text]))
  with check ((select public.get_role()) = any (array['administration'::text, 'proviseur'::text, 'superadmin'::text]));

alter policy eleve_self on public.eleves
  to authenticated
  using (auth_user_id = (select auth.uid()) and (select public.get_role()) = 'eleve'::text)
  with check (auth_user_id = (select auth.uid()) and (select public.get_role()) = 'eleve'::text);

alter policy pp_prof_classe_eleves on public.eleves
  to authenticated
  using (
    (select public.get_role()) = any (array['pp'::text, 'professeur'::text])
    and exists (
      select 1
      from public.classes c
      where c.id = eleves.classe_id
        and c.professeur_principal_id = (select auth.uid())
    )
  );

alter policy admin_edite_etablissement on public.etablissement
  to authenticated
  using ((select public.get_role()) = any (array['administration'::text, 'superadmin'::text]))
  with check ((select public.get_role()) = any (array['administration'::text, 'superadmin'::text]));

alter policy tous_lisent_etablissement on public.etablissement
  to authenticated
  using ((select auth.uid()) is not null);

alter policy admin_all_go on public.fiches_grand_oral
  to authenticated
  using ((select public.get_role()) = any (array['administration'::text, 'proviseur'::text, 'superadmin'::text]))
  with check ((select public.get_role()) = any (array['administration'::text, 'proviseur'::text, 'superadmin'::text]));

alter policy eleve_sa_fiche_go on public.fiches_grand_oral
  to authenticated
  using (
    (select public.get_role()) = 'eleve'::text
    and exists (
      select 1
      from public.eleves e
      where e.id = fiches_grand_oral.eleve_id
        and e.auth_user_id = (select auth.uid())
    )
  )
  with check (
    (select public.get_role()) = 'eleve'::text
    and exists (
      select 1
      from public.eleves e
      where e.id = fiches_grand_oral.eleve_id
        and e.auth_user_id = (select auth.uid())
    )
  );

alter policy prof_ses_fiches_go on public.fiches_grand_oral
  to authenticated
  using (
    (select public.get_role()) = 'professeur'::text
    and (prof_spe1_id = (select auth.uid()) or prof_spe2_id = (select auth.uid()))
  )
  with check (
    (select public.get_role()) = 'professeur'::text
    and (prof_spe1_id = (select auth.uid()) or prof_spe2_id = (select auth.uid()))
  );

alter policy admin_edite_professeurs on public.professeurs
  to authenticated
  using ((select public.get_role()) = any (array['administration'::text, 'superadmin'::text]))
  with check ((select public.get_role()) = any (array['administration'::text, 'superadmin'::text]));

alter policy tous_lisent_professeurs on public.professeurs
  to authenticated
  using ((select auth.uid()) is not null);

alter policy admin_all_stages on public.stages
  to authenticated
  using ((select public.get_role()) = any (array['administration'::text, 'proviseur'::text, 'superadmin'::text]))
  with check ((select public.get_role()) = any (array['administration'::text, 'proviseur'::text, 'superadmin'::text]));

alter policy eleve_son_stage on public.stages
  to authenticated
  using (
    (select public.get_role()) = 'eleve'::text
    and exists (
      select 1
      from public.eleves e
      where e.id = stages.eleve_id
        and e.auth_user_id = (select auth.uid())
    )
  )
  with check (
    (select public.get_role()) = 'eleve'::text
    and exists (
      select 1
      from public.eleves e
      where e.id = stages.eleve_id
        and e.auth_user_id = (select auth.uid())
    )
  );

alter policy pp_classe_stages on public.stages
  to authenticated
  using (
    (select public.get_role()) = any (array['pp'::text, 'professeur'::text])
    and exists (
      select 1
      from public.eleves e
      join public.classes c on c.id = e.classe_id
      where e.id = stages.eleve_id
        and c.professeur_principal_id = (select auth.uid())
    )
  );

alter policy referent_ses_stages on public.stages
  to authenticated
  using (
    (select public.get_role()) = 'professeur'::text
    and professeur_referent_id = (select auth.uid())
  )
  with check (
    (select public.get_role()) = 'professeur'::text
    and professeur_referent_id = (select auth.uid())
  );

alter policy superadmin_edite_templates on public.templates_documents
  to authenticated
  using ((select public.get_role()) = 'superadmin'::text)
  with check ((select public.get_role()) = 'superadmin'::text);

alter policy tous_lisent_templates on public.templates_documents
  to authenticated
  using ((select auth.uid()) is not null);

-- The unique constraints already provide equivalent btree indexes.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.professeurs'::regclass
      and conname in (
        'professeurs_auth_user_id_key',
        'professeurs_code_acces_key',
        'professeurs_email_key'
      )
    group by conrelid
    having count(*) = 3
  ) then
    raise exception 'Expected unique constraints on professeurs are missing';
  end if;
end
$$;

drop index if exists public.idx_professeurs_auth_user_id;
drop index if exists public.idx_professeurs_code_acces;
drop index if exists public.idx_professeurs_email;
drop index if exists public.professeurs_email_idx;

commit;
