begin;

create table public.knowledge_source_excerpts (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  source_id uuid not null,
  document_id uuid not null,
  ordinal integer not null check (ordinal between 0 and 39),
  excerpt_text text not null check (
    length(btrim(excerpt_text)) between 20 and 1200
  ),
  content_hash text not null check (content_hash ~ '^[a-f0-9]{64}$'),
  created_at timestamptz not null default now(),
  foreign key (source_id, institution_id)
    references public.knowledge_sources(id, institution_id) on delete cascade,
  foreign key (document_id, institution_id)
    references public.knowledge_documents(id, institution_id) on delete cascade,
  unique (source_id, ordinal),
  unique (source_id, content_hash)
);

create index knowledge_source_excerpts_institution_source_idx
  on public.knowledge_source_excerpts (institution_id, source_id, ordinal);

alter table public.knowledge_source_excerpts enable row level security;
alter table public.knowledge_source_excerpts force row level security;
revoke all on table public.knowledge_source_excerpts from public, anon, authenticated;
grant select, insert, update, delete on table public.knowledge_source_excerpts to service_role;

commit;

