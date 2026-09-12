-- Server-computed opaque request binding. The push worker needs no identity HMAC secret.
alter table public.support_push_subscriptions add column identity_owner_hash text;
alter table public.support_push_subscriptions add constraint support_push_identity_binding_check check (
  (identity_session_id is null and identity_owner_hash is null)
  or (identity_session_id is not null and identity_owner_hash is not null and identity_owner_hash ~ '^[a-f0-9]{64}$')
);
