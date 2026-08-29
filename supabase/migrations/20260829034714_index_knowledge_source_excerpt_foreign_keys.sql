begin;

create index knowledge_source_excerpts_source_institution_fk_idx
  on public.knowledge_source_excerpts (source_id, institution_id);

create index knowledge_source_excerpts_document_institution_fk_idx
  on public.knowledge_source_excerpts (document_id, institution_id);

commit;

