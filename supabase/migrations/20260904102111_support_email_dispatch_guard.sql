begin;

-- A durable receipt survives provider timeouts, queue leases and worker restarts.
-- No recipient, content, access token or access code belongs in this table.
create table public.support_email_dispatches (
  institution_id uuid not null references public.institutions(id),
  event_key text not null check (event_key ~ '^[a-f0-9]{64}$'),
  request_id uuid not null,
  job_id uuid not null,
  state text not null check (state in ('dispatching', 'sent', 'rejected', 'uncertain')),
  provider_reference text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (institution_id, event_key),
  foreign key (request_id, institution_id)
    references public.support_requests(id, institution_id) on delete cascade
);
create index support_email_dispatches_request_idx
  on public.support_email_dispatches(request_id, institution_id);
alter table public.support_email_dispatches enable row level security;
alter table public.support_email_dispatches force row level security;
revoke all on public.support_email_dispatches from public, anon, authenticated;
grant select, insert, update, delete on public.support_email_dispatches to service_role;

commit;
