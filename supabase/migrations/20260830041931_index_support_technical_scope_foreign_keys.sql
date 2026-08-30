begin;

create index if not exists support_job_runs_request_institution_idx
  on public.support_job_runs (request_id, institution_id);

create index if not exists support_failed_jobs_request_institution_idx
  on public.support_failed_jobs (request_id, institution_id);

commit;
