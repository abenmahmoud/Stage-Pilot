begin;

alter table public.knowledge_documents
  add column owner_service_code text,
  add column valid_from date,
  add column review_due_at timestamptz;

update public.knowledge_documents
set
  owner_service_code = coalesce(service_codes[1], 'administration'),
  valid_from = current_date,
  review_due_at = now() + interval '180 days'
where owner_service_code is null
   or valid_from is null
   or review_due_at is null;

alter table public.knowledge_documents
  alter column owner_service_code set not null,
  alter column valid_from set not null,
  alter column review_due_at set not null;

alter table public.knowledge_documents
  drop constraint knowledge_documents_source_type_check,
  add constraint knowledge_documents_source_type_check check (
    source_type in ('internal_document', 'procedure', 'calendar', 'form_template')
  ),
  add constraint knowledge_documents_owner_service_check check (
    owner_service_code in (
      'referent_numerique', 'ddfpt', 'secretariat', 'vie_scolaire',
      'intendance', 'direction', 'administration'
    )
  ),
  add constraint knowledge_documents_review_dates_check check (
    review_due_at::date >= valid_from
  );

create index knowledge_documents_owner_review_idx
  on public.knowledge_documents (
    institution_id,
    owner_service_code,
    review_due_at
  );

comment on column public.knowledge_documents.owner_service_code is
  'Human service responsible for accuracy, review and withdrawal.';
comment on column public.knowledge_documents.valid_from is
  'Business effective date; it does not publish the document automatically.';
comment on column public.knowledge_documents.review_due_at is
  'Mandatory human review deadline before the source can remain trusted.';

commit;
