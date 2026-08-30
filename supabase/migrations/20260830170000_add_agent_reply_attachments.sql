begin;

alter table public.support_attachments
  add column if not exists direction text not null default 'requester',
  add column if not exists uploaded_by_user uuid,
  add column if not exists released_at timestamptz,
  add column if not exists released_by uuid;

alter table public.support_attachments
  drop constraint if exists support_attachments_direction_check,
  add constraint support_attachments_direction_check
    check (direction in ('requester', 'agent')),
  drop constraint if exists support_attachments_agent_release_guard,
  add constraint support_attachments_agent_release_guard
    check (
      (
        direction = 'requester'
        and uploaded_by_user is null
        and released_at is null
        and released_by is null
      )
      or
      (
        direction = 'agent'
        and uploaded_by_user is not null
        and uploaded_by_session is null
        and (
          (
            released_at is null
            and released_by is null
            and message_id is null
          )
          or
          (
            released_at is not null
            and released_by is not null
            and message_id is not null
          )
        )
      )
    );

create index if not exists support_attachments_request_direction_release_idx
  on public.support_attachments (request_id, direction, released_at, created_at);

commit;
