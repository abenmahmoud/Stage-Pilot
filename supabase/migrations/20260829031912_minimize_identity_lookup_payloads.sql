begin;

alter table public.identity_directory_lookup_requests
  alter column request_schema drop not null,
  alter column request_key_version drop not null,
  alter column request_wrapped_key drop not null,
  alter column request_iv drop not null,
  alter column request_auth_tag drop not null,
  alter column request_ciphertext drop not null;

alter table public.identity_directory_lookup_requests
  add constraint identity_directory_lookup_request_payload_check check (
    (
      status in ('queued', 'processing')
      and request_schema = 1
      and request_key_version is not null
      and request_wrapped_key is not null
      and request_iv is not null
      and request_auth_tag is not null
      and request_ciphertext is not null
    )
    or
    (
      status not in ('queued', 'processing')
      and request_schema is null
      and request_key_version is null
      and request_wrapped_key is null
      and request_iv is null
      and request_auth_tag is null
      and request_ciphertext is null
    )
  );

comment on constraint identity_directory_lookup_request_payload_check
on public.identity_directory_lookup_requests is
  'Encrypted query payload exists only while the request is queued or processing.';

commit;
