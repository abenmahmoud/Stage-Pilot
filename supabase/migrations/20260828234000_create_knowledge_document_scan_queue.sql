begin;

select pgmq.create('knowledge_document_scan');

revoke all on table
  pgmq.q_knowledge_document_scan,
  pgmq.a_knowledge_document_scan
from public, anon, authenticated;

comment on table pgmq.q_knowledge_document_scan is
  'Private queue for local antivirus and bounded knowledge-document extraction.';

commit;
