begin;

select pgmq.create('schedule_document_scan');

alter table pgmq.q_schedule_document_scan enable row level security;
alter table pgmq.q_schedule_document_scan force row level security;
alter table pgmq.a_schedule_document_scan enable row level security;
alter table pgmq.a_schedule_document_scan force row level security;

revoke all on table
  pgmq.q_schedule_document_scan,
  pgmq.a_schedule_document_scan
from public, anon, authenticated;

comment on table pgmq.q_schedule_document_scan is
  'Private queue for local schedule PDF antivirus and page-count validation.';

commit;
