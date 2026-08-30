begin;

create table public.support_assistant_routing_reviews (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null
    references public.institutions(id) on delete restrict,
  request_id uuid not null,
  receipt_hash text not null,
  used_ai boolean not null,
  model text,
  initial_category text not null,
  initial_service text not null,
  status text not null default 'pending',
  reviewed_by uuid references auth.users(id) on delete restrict,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint support_assistant_routing_reviews_request_scope_fkey
    foreign key (request_id, institution_id)
    references public.support_requests(id, institution_id)
    on delete cascade,
  constraint support_assistant_routing_reviews_request_key unique (request_id),
  constraint support_assistant_routing_reviews_receipt_key
    unique (institution_id, receipt_hash),
  constraint support_assistant_routing_reviews_hash_check
    check (receipt_hash ~ '^[a-f0-9]{64}$'),
  constraint support_assistant_routing_reviews_category_check
    check (initial_category ~ '^[a-z][a-z0-9_]{1,39}$'),
  constraint support_assistant_routing_reviews_service_check
    check (initial_service in (
      'referent_numerique',
      'ddfpt',
      'secretariat',
      'vie_scolaire',
      'intendance',
      'direction',
      'administration'
    )),
  constraint support_assistant_routing_reviews_status_check
    check (status in ('pending', 'confirmed', 'corrected')),
  constraint support_assistant_routing_reviews_model_check
    check (model is null or char_length(model) between 1 and 80),
  constraint support_assistant_routing_reviews_ai_consistency_check
    check (used_ai = (model is not null)),
  constraint support_assistant_routing_reviews_resolution_check
    check (
      (status = 'pending' and reviewed_by is null and reviewed_at is null)
      or
      (status in ('confirmed', 'corrected') and reviewed_by is not null and reviewed_at is not null)
    )
);

create index support_assistant_routing_reviews_status_idx
  on public.support_assistant_routing_reviews (institution_id, status, created_at);

create index support_assistant_routing_reviews_reviewer_idx
  on public.support_assistant_routing_reviews (reviewed_by);

create or replace function public.support_validate_assistant_routing_review_transition()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.institution_id is distinct from old.institution_id
    or new.request_id is distinct from old.request_id
    or new.receipt_hash is distinct from old.receipt_hash
    or new.used_ai is distinct from old.used_ai
    or new.model is distinct from old.model
    or new.initial_category is distinct from old.initial_category
    or new.initial_service is distinct from old.initial_service
    or new.created_at is distinct from old.created_at then
    raise exception 'Assistant routing review binding fields are immutable';
  end if;

  if old.status <> 'pending' then
    raise exception 'Resolved assistant routing review is immutable';
  end if;

  if new.status not in ('confirmed', 'corrected')
    or new.reviewed_by is null
    or new.reviewed_at is null then
    raise exception 'Assistant routing review requires a terminal human decision';
  end if;

  return new;
end;
$$;

create trigger support_validate_assistant_routing_review_transition
before update on public.support_assistant_routing_reviews
for each row execute function public.support_validate_assistant_routing_review_transition();

alter table public.support_assistant_routing_reviews enable row level security;
alter table public.support_assistant_routing_reviews force row level security;

revoke all on table public.support_assistant_routing_reviews
  from public, anon, authenticated;
revoke all on function public.support_validate_assistant_routing_review_transition()
  from public, anon, authenticated;

grant select, insert, update on table public.support_assistant_routing_reviews
  to service_role;
grant execute on function public.support_validate_assistant_routing_review_transition()
  to service_role;

commit;
