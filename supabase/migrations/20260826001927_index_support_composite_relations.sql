begin;

-- Composite indexes cover the cross-dossier integrity constraints and replace
-- the narrower indexes because their first columns are identical.
create index support_attachments_message_request_idx
  on public.support_attachments (message_id, request_id)
  where message_id is not null;

drop index if exists public.support_attachments_message_idx;

create index support_callbacks_contact_request_idx
  on public.support_callback_tasks (phone_contact_id, request_id);

drop index if exists public.support_callbacks_contact_idx;

commit;
