-- Recovered from the Supabase migration journal.
alter table public.professeurs
  add column if not exists code_acces text unique;

create index if not exists idx_professeurs_code_acces
  on public.professeurs (code_acces);

alter table public.professeurs
  alter column email drop not null;

do $$
begin
  if exists (
    select 1 from pg_constraint where conname = 'professeurs_email_unique'
  ) then
    alter table public.professeurs drop constraint professeurs_email_unique;
  end if;
end $$;

create index if not exists idx_professeurs_email
  on public.professeurs (email);
