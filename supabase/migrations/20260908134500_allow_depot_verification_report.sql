begin;

update storage.buckets
set allowed_mime_types = array_append(
  coalesce(allowed_mime_types, '{}'::text[]),
  'text/plain'
)
where id = 'identity-ingest'
  and not ('text/plain' = any(coalesce(allowed_mime_types, '{}'::text[])));

commit;
