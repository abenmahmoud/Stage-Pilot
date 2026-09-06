begin;

-- LOT 5 du plan de connaissance OB1 (2026-09-05) : file de validation des
-- propositions de connaissance et passage « publié -> connaissance ».
-- Reutilise l'administration existante (`knowledge_sources`, roles de
-- gestion des connaissances) : cette table est la seule nouveaute, elle joue
-- pour une conversation ou une actualite publiee le role que
-- `knowledge_documents` joue deja pour un document televerse (`review.ts`).
--
-- Deux origines seulement, jamais melangees (contrainte de paire ci-dessous) :
--   - 'conversation'      : une proposition issue d'une discussion, deja
--     redigee et expurgee des donnees personnelles par un responsable avant
--     d'entrer en file (bullet 1 du plan). `proposed_text` est NULL si des
--     signaux de vie privee/secret ont ete detectes : la proposition entre
--     quand meme en file (tracabilite), mais ne peut jamais etre approuvee
--     dans cet etat (voir contrainte plus bas), seulement rejetee.
--   - 'flash_publication' : creee depuis une actualite DEJA publiee
--     (bullet 2). `origin_flash_info_id`/`origin_flash_version_id` sont
--     immuables et servent a retrouver la connaissance derivee lorsque
--     l'actualite est corrigee (voir `api/flash/proposals/[id]/correction.ts`).
--
-- Deux decisions humaines distinctes, jamais plus, jamais moins :
--   (A) la creation de la proposition (« rendre utilisable par l'agent », ou
--       la soumission d'un texte de conversation) — n'active jamais rien ;
--   (B) la validation de la proposition (`status: 'approved'`) — qui cree
--       DIRECTEMENT la source en `knowledge_sources` avec `status: 'published'`
--       (pas `'draft'`) : c'est cette seconde validation, et elle seule, qui
--       « rend utilisable » au sens du plan. Aucune troisieme etape.

create table public.knowledge_source_proposals (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  origin text not null check (origin in ('conversation', 'flash_publication')),
  origin_conversation_id uuid,
  origin_flash_info_id uuid references public.flash_infos(id) on delete restrict,
  origin_flash_version_id uuid references public.flash_info_versions(id) on delete restrict,
  title text not null check (length(btrim(title)) between 2 and 180),
  proposed_text text check (
    proposed_text is null or length(btrim(proposed_text)) between 20 and 8000
  ),
  privacy_signals text[] not null default array[]::text[] check (
    array_position(privacy_signals, null) is null
  ),
  classification text not null default 'internal' check (
    classification in ('public', 'internal', 'personal', 'sensitive')
  ),
  service_codes text[] not null default array[]::text[] check (
    service_codes <@ array[
      'referent_numerique',
      'ddfpt',
      'secretariat',
      'vie_scolaire',
      'intendance',
      'direction',
      'administration'
    ]::text[]
    and array_position(service_codes, null) is null
  ),
  valid_from timestamptz not null,
  expires_at timestamptz,
  provenance_status text not null check (
    provenance_status in (
      'observed', 'inferred', 'user_confirmed', 'imported', 'generated',
      'superseded', 'disputed'
    )
  ),
  use_policy text not null check (
    use_policy in (
      'can_use_as_instruction', 'can_use_as_evidence',
      'requires_human_confirmation', 'do_not_inject_automatically'
    )
  ),
  status text not null default 'pending_review' check (
    status in ('pending_review', 'approved', 'rejected')
  ),
  proposed_by uuid not null references auth.users(id) on delete restrict,
  reviewed_by uuid references auth.users(id) on delete restrict,
  reviewed_at timestamptz,
  review_note text check (
    review_note is null or length(btrim(review_note)) between 10 and 1000
  ),
  source_id uuid references public.knowledge_sources(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Une origine ne porte jamais les references de l'autre (jamais melangees).
  check (
    (
      origin = 'conversation'
      and origin_conversation_id is not null
      and origin_flash_info_id is null
      and origin_flash_version_id is null
    ) or (
      origin = 'flash_publication'
      and origin_conversation_id is null
      and origin_flash_info_id is not null
      and origin_flash_version_id is not null
    )
  ),
  check (expires_at is null or expires_at > valid_from),
  check (classification <> 'public' or cardinality(service_codes) = 0),
  -- Regle 2 du plan rendue structurelle ici aussi (meme regle qu'au LOT 1 sur
  -- knowledge_sources) : une proposition generee/inferee ne peut jamais
  -- porter une politique d'usage « consigne ».
  check (
    provenance_status not in ('generated', 'inferred')
    or use_policy <> 'can_use_as_instruction'
  ),
  -- Une proposition dont le texte a ete retire pour signal de vie privee/
  -- secret ne peut jamais etre approuvee : seul un rejet, ou une nouvelle
  -- proposition avec un texte propre, peut la faire progresser.
  check (cardinality(privacy_signals) = 0 or status <> 'approved'),
  -- Un texte absent (retire pour signal) ne peut coexister avec une
  -- approbation ; un texte present est obligatoire hors de cet etat.
  check ((proposed_text is null) = (cardinality(privacy_signals) > 0)),
  -- Triptyque statut/relecture/source strictement aligne : pas de relecture
  -- pour une proposition en attente, relecture complete sinon, et une source
  -- posee si et seulement si la proposition est approuvee.
  check (
    (status = 'pending_review' and reviewed_by is null and reviewed_at is null and review_note is null and source_id is null)
    or (status = 'approved' and reviewed_by is not null and reviewed_at is not null and review_note is not null and source_id is not null)
    or (status = 'rejected' and reviewed_by is not null and reviewed_at is not null and review_note is not null and source_id is null)
  ),
  unique (id, institution_id)
);

create index knowledge_source_proposals_institution_status_idx
  on public.knowledge_source_proposals (institution_id, status, created_at desc);
create index knowledge_source_proposals_flash_info_idx
  on public.knowledge_source_proposals (origin_flash_info_id)
  where origin_flash_info_id is not null;
create unique index knowledge_source_proposals_source_id_uidx
  on public.knowledge_source_proposals (source_id)
  where source_id is not null;

create trigger knowledge_source_proposals_set_updated_at
before update on public.knowledge_source_proposals
for each row execute function public.support_set_updated_at();

-- Immuabilite des champs declaratifs poses a la creation : seule la
-- transition de revue (status/reviewed_*/review_note/source_id/updated_at)
-- peut changer une ligne apres coup (meme principe que
-- `knowledge_sources_supersede_guard`, LOT 1).
create or replace function public.knowledge_source_proposals_immutable_origin_guard()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.institution_id is distinct from old.institution_id
    or new.origin is distinct from old.origin
    or new.origin_conversation_id is distinct from old.origin_conversation_id
    or new.origin_flash_info_id is distinct from old.origin_flash_info_id
    or new.origin_flash_version_id is distinct from old.origin_flash_version_id
    or new.title is distinct from old.title
    or new.proposed_text is distinct from old.proposed_text
    or new.privacy_signals is distinct from old.privacy_signals
    or new.classification is distinct from old.classification
    or new.service_codes is distinct from old.service_codes
    or new.valid_from is distinct from old.valid_from
    or new.expires_at is distinct from old.expires_at
    or new.provenance_status is distinct from old.provenance_status
    or new.use_policy is distinct from old.use_policy
    or new.proposed_by is distinct from old.proposed_by
    or new.created_at is distinct from old.created_at then
    raise exception 'knowledge_source_proposals_origin_is_immutable';
  end if;
  return new;
end;
$$;

create trigger knowledge_source_proposals_immutable_origin_guard_trigger
before update on public.knowledge_source_proposals
for each row execute function public.knowledge_source_proposals_immutable_origin_guard();

revoke all on function public.knowledge_source_proposals_immutable_origin_guard()
from public, anon, authenticated;
grant execute on function public.knowledge_source_proposals_immutable_origin_guard() to service_role;

alter table public.knowledge_source_proposals enable row level security;
alter table public.knowledge_source_proposals force row level security;
revoke all on table public.knowledge_source_proposals from public, anon, authenticated;
grant select, insert, update, delete on table public.knowledge_source_proposals to service_role;

-- LOT 5 : la connaissance derivee d'une actualite ou d'une conversation est
-- un type de source distinct des saisies directes du registre (LOT 1).
alter table public.knowledge_sources
  drop constraint knowledge_sources_source_type_check;
alter table public.knowledge_sources
  add constraint knowledge_sources_source_type_check check (
    source_type in (
      'official_url', 'internal_document', 'procedure', 'directory',
      'calendar', 'flash_publication', 'conversation'
    )
  );

alter table public.agent_skill_audit
  drop constraint agent_skill_audit_resource_type_check;
alter table public.agent_skill_audit
  add constraint agent_skill_audit_resource_type_check check (
    resource_type in ('source', 'skill', 'version', 'document', 'proposal')
  );

alter table public.agent_skill_audit
  drop constraint agent_skill_audit_action_check;
alter table public.agent_skill_audit
  add constraint agent_skill_audit_action_check check (
    action in (
      'create', 'create_version', 'update', 'submit_review', 'publish',
      'retire', 'rollback', 'expire', 'revoke', 'reserve_upload',
      'confirm_upload', 'reject_upload', 'queue_analysis',
      'complete_analysis', 'review_document', 'consult_public',
      'access_document', 'purge_document', 'fail_purge',
      'propose_knowledge_source', 'review_knowledge_proposal'
    )
  );

comment on table public.knowledge_source_proposals is
  'File de validation LOT 5 (plan de connaissance OB1) : une conversation ou une actualite publiee entre ici en attente, jamais directement dans knowledge_sources.';
comment on column public.knowledge_source_proposals.proposed_text is
  'NULL si un signal de vie privee/secret a ete detecte a la creation (texte retire, contrainte : ne peut alors jamais etre approuvee).';
comment on column public.knowledge_source_proposals.origin_flash_info_id is
  'Immuable. Sert a retrouver et revoquer la connaissance derivee lors d''une correction de l''actualite source.';

commit;

-- ---------------------------------------------------------------------------
-- Migration inverse (non appliquee automatiquement ; meme convention que les
-- migrations precedentes de ce dossier, pas de fichier `down`) :
--
-- begin;
-- alter table public.agent_skill_audit
--   drop constraint agent_skill_audit_action_check;
-- alter table public.agent_skill_audit
--   add constraint agent_skill_audit_action_check check (
--     action in (
--       'create', 'create_version', 'update', 'submit_review', 'publish',
--       'retire', 'rollback', 'expire', 'revoke', 'reserve_upload',
--       'confirm_upload', 'reject_upload', 'queue_analysis',
--       'complete_analysis', 'review_document', 'consult_public',
--       'access_document', 'purge_document', 'fail_purge'
--     )
--   );
-- alter table public.agent_skill_audit
--   drop constraint agent_skill_audit_resource_type_check;
-- alter table public.agent_skill_audit
--   add constraint agent_skill_audit_resource_type_check check (
--     resource_type in ('source', 'skill', 'version', 'document')
--   );
-- alter table public.knowledge_sources
--   drop constraint knowledge_sources_source_type_check;
-- alter table public.knowledge_sources
--   add constraint knowledge_sources_source_type_check check (
--     source_type in ('official_url', 'internal_document', 'procedure', 'directory', 'calendar')
--   );
-- drop trigger if exists knowledge_source_proposals_immutable_origin_guard_trigger on public.knowledge_source_proposals;
-- drop function if exists public.knowledge_source_proposals_immutable_origin_guard();
-- drop table if exists public.knowledge_source_proposals;
-- commit;
