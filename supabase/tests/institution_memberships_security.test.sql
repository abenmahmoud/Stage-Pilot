begin;

select plan(10);

select has_table('public', 'institutions', 'institutions table exists');
select has_table(
  'public',
  'institution_memberships',
  'institution memberships table exists'
);
select is(
  (select relrowsecurity from pg_class where oid = 'public.institutions'::regclass),
  true,
  'institutions has RLS enabled'
);
select is(
  (select relforcerowsecurity from pg_class where oid = 'public.institutions'::regclass),
  true,
  'institutions forces RLS'
);
select is(
  (
    select relrowsecurity
    from pg_class
    where oid = 'public.institution_memberships'::regclass
  ),
  true,
  'institution memberships has RLS enabled'
);
select is(
  (
    select relforcerowsecurity
    from pg_class
    where oid = 'public.institution_memberships'::regclass
  ),
  true,
  'institution memberships forces RLS'
);
select ok(
  not has_table_privilege('anon', 'public.institutions', 'select'),
  'anon cannot read institutions'
);
select ok(
  not has_table_privilege('authenticated', 'public.institutions', 'select'),
  'authenticated cannot read institutions directly'
);
select ok(
  not has_table_privilege('anon', 'public.institution_memberships', 'select'),
  'anon cannot read memberships'
);
select ok(
  not has_table_privilege('authenticated', 'public.institution_memberships', 'select'),
  'authenticated cannot read memberships directly'
);

select * from finish();
rollback;
