begin;

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  '00000000-0000-0000-0000-000000000000',
  '00000000-0000-4000-8000-000000006001',
  'authenticated', 'authenticated', 'routing-review@example.test', '',
  transaction_timestamp(), '{"provider":"email","providers":["email"]}'::jsonb,
  '{}'::jsonb, transaction_timestamp(), transaction_timestamp()
);

insert into public.institutions (id, slug, name, status) values
  ('00000000-0000-4000-8000-000000006002', 'routing-review-a', 'Routing Preview A', 'draft'),
  ('00000000-0000-4000-8000-000000006003', 'routing-review-b', 'Routing Preview B', 'draft');

insert into public.support_requests (
  id, institution_id, public_code, idempotency_key_hash, requester_type,
  requester_first_name, requester_last_name, beneficiary_type,
  category, subject, description, preferred_channel, assigned_team
) values (
  '00000000-0000-4000-8000-000000006010',
  '00000000-0000-4000-8000-000000006002',
  'BC-2099-006010', repeat('1', 64), 'eleve', 'Test', 'Fictif', 'self',
  'ent', 'Demande fictive', 'Contenu fictif sans donnée réelle', 'web',
  'referent_numerique'
);

insert into public.support_requests (
  id, institution_id, public_code, idempotency_key_hash, requester_type,
  requester_first_name, requester_last_name, beneficiary_type,
  category, subject, description, preferred_channel, assigned_team
) values (
  '00000000-0000-4000-8000-000000006011',
  '00000000-0000-4000-8000-000000006002',
  'BC-2099-006011', repeat('2', 64), 'parent', 'Autre', 'Test', 'self',
  'ent', 'Seconde demande fictive', 'Contenu distinct et fictif', 'web',
  'referent_numerique'
);

insert into public.support_assistant_routing_reviews (
  id, institution_id, request_id, receipt_hash, used_ai, model,
  initial_category, initial_service
) values (
  '00000000-0000-4000-8000-000000006020',
  '00000000-0000-4000-8000-000000006002',
  '00000000-0000-4000-8000-000000006010', repeat('a', 64), true,
  'gpt-test', 'ent', 'referent_numerique'
);

do $$
declare
  duplicate_request_blocked boolean := false;
  receipt_replay_blocked boolean := false;
  cross_scope_blocked boolean := false;
  binding_change_blocked boolean := false;
  second_decision_blocked boolean := false;
begin
  begin
    insert into public.support_assistant_routing_reviews (
      institution_id, request_id, receipt_hash, used_ai, model,
      initial_category, initial_service
    ) values (
      '00000000-0000-4000-8000-000000006002',
      '00000000-0000-4000-8000-000000006010', repeat('b', 64), false, null,
      'ent', 'referent_numerique'
    );
  exception when unique_violation then
    duplicate_request_blocked := true;
  end;

  begin
    insert into public.support_assistant_routing_reviews (
      institution_id, request_id, receipt_hash, used_ai, model,
      initial_category, initial_service
    ) values (
      '00000000-0000-4000-8000-000000006002',
      '00000000-0000-4000-8000-000000006011', repeat('a', 64), false, null,
      'ent', 'referent_numerique'
    );
  exception when unique_violation then
    receipt_replay_blocked := true;
  end;

  begin
    insert into public.support_assistant_routing_reviews (
      institution_id, request_id, receipt_hash, used_ai, model,
      initial_category, initial_service
    ) values (
      '00000000-0000-4000-8000-000000006003',
      '00000000-0000-4000-8000-000000006010', repeat('c', 64), false, null,
      'ent', 'referent_numerique'
    );
  exception when foreign_key_violation then
    cross_scope_blocked := true;
  end;

  begin
    update public.support_assistant_routing_reviews
    set initial_service = 'secretariat'
    where id = '00000000-0000-4000-8000-000000006020';
  exception when others then
    binding_change_blocked := true;
  end;

  update public.support_assistant_routing_reviews
  set status = 'confirmed',
      reviewed_by = '00000000-0000-4000-8000-000000006001',
      reviewed_at = transaction_timestamp()
  where id = '00000000-0000-4000-8000-000000006020';

  begin
    update public.support_assistant_routing_reviews
    set status = 'corrected'
    where id = '00000000-0000-4000-8000-000000006020';
  exception when others then
    second_decision_blocked := true;
  end;

  if not duplicate_request_blocked
    or not receipt_replay_blocked
    or not cross_scope_blocked
    or not binding_change_blocked
    or not second_decision_blocked then
    raise exception 'Routing review security recipe failed';
  end if;

  if has_table_privilege('anon', 'public.support_assistant_routing_reviews', 'select')
    or has_table_privilege('authenticated', 'public.support_assistant_routing_reviews', 'select')
    or has_table_privilege('authenticated', 'public.support_assistant_routing_reviews', 'update') then
    raise exception 'Client role unexpectedly has routing review privileges';
  end if;
end
$$;

rollback;
