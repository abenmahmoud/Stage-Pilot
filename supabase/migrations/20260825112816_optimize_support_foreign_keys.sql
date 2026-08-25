create index support_attachments_request_idx
  on public.support_attachments (request_id);
create index support_attachments_message_idx
  on public.support_attachments (message_id)
  where message_id is not null;
create index support_attachments_session_idx
  on public.support_attachments (uploaded_by_session)
  where uploaded_by_session is not null;

create index support_callbacks_request_idx
  on public.support_callback_tasks (request_id);
create index support_callbacks_contact_idx
  on public.support_callback_tasks (phone_contact_id);
create index support_callbacks_agent_idx
  on public.support_callback_tasks (assigned_to)
  where assigned_to is not null;

create index support_delivery_message_idx
  on public.support_delivery_events (message_id)
  where message_id is not null;
create index support_failed_jobs_request_idx
  on public.support_failed_jobs (request_id)
  where request_id is not null;
create index support_job_runs_request_idx
  on public.support_job_runs (request_id)
  where request_id is not null;
create index support_magic_tokens_request_idx
  on public.support_magic_tokens (request_id);

create index support_requests_student_idx
  on public.support_requests (student_id)
  where student_id is not null;
create index support_requests_professeur_idx
  on public.support_requests (professeur_id)
  where professeur_id is not null;
create index support_session_requests_request_idx
  on public.support_session_requests (request_id);
