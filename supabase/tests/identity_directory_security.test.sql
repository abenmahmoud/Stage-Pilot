begin;

select plan(27);

select has_table('public', 'identity_directory_imports', 'identity imports table exists');
select has_table('public', 'contact_verifications', 'contact verifications table exists');
select has_table('public', 'school_identities', 'school identities table exists');
select has_table('public', 'school_relationships', 'school relationships table exists');
select has_column('public', 'identity_directory_imports', 'retired_by', 'identity imports record who retired a version');
select has_column('public', 'identity_directory_imports', 'retired_at', 'identity imports record when a version was retired');
select has_column('public', 'identity_directory_imports', 'retirement_reason', 'identity imports retain the human retirement reason');
select has_function('public', 'identity_directory_require_active_source', array[]::text[], 'inactive directory versions cannot create identities');
select has_table('public', 'identity_directory_private_rows', 'encrypted private identity rows table exists');
select is((select relrowsecurity from pg_class where oid = 'public.identity_directory_private_rows'::regclass), true, 'private identity rows has RLS enabled');
select is((select relforcerowsecurity from pg_class where oid = 'public.identity_directory_private_rows'::regclass), true, 'private identity rows forces RLS');

select is((select relrowsecurity from pg_class where oid = 'public.identity_directory_imports'::regclass), true, 'identity imports has RLS enabled');
select is((select relforcerowsecurity from pg_class where oid = 'public.identity_directory_imports'::regclass), true, 'identity imports forces RLS');
select is((select relrowsecurity from pg_class where oid = 'public.contact_verifications'::regclass), true, 'contact verifications has RLS enabled');
select is((select relforcerowsecurity from pg_class where oid = 'public.contact_verifications'::regclass), true, 'contact verifications forces RLS');
select is((select relrowsecurity from pg_class where oid = 'public.school_identities'::regclass), true, 'school identities has RLS enabled');
select is((select relforcerowsecurity from pg_class where oid = 'public.school_identities'::regclass), true, 'school identities forces RLS');

select ok(not has_table_privilege('anon', 'public.identity_directory_imports', 'select'), 'anon cannot read imports');
select ok(not has_table_privilege('authenticated', 'public.identity_directory_imports', 'select'), 'authenticated cannot read imports directly');
select ok(not has_table_privilege('anon', 'public.contact_verifications', 'select'), 'anon cannot read contact verifications');
select ok(not has_table_privilege('authenticated', 'public.contact_verifications', 'select'), 'authenticated cannot read contact verifications directly');
select ok(not has_table_privilege('anon', 'public.school_identities', 'select'), 'anon cannot read identities');
select ok(not has_table_privilege('authenticated', 'public.school_identities', 'select'), 'authenticated cannot read identities directly');
select ok(not has_table_privilege('anon', 'public.school_relationships', 'select'), 'anon cannot read relationships');
select ok(not has_table_privilege('authenticated', 'public.school_relationships', 'select'), 'authenticated cannot read relationships directly');
select ok(not has_table_privilege('anon', 'public.identity_directory_audit', 'select'), 'anon cannot read identity audit');
select ok(not has_table_privilege('authenticated', 'public.identity_directory_audit', 'select'), 'authenticated cannot read identity audit directly');

select * from finish();
rollback;
