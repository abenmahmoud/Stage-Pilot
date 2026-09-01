// Emit a rollback-only recipe; never connect to a database from this script.
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { sql } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { SUPPORT_RATE_LIMIT_POLICIES } from "../shared/support-rate-limit-policy.ts";

const file = readFileSync(new URL("../api/_shared/support.ts", import.meta.url), "utf8");
const ast = ts.createSourceFile("support.ts", file, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
const functions = ast.statements.filter((node) => ts.isFunctionDeclaration(node)
  && ["validateSupportRateLimitAttempt", "enforceSupportRateLimits"].includes(node.name?.text));
assert.equal(functions.length, 2);
const source = functions.map((node) => node.getFullText(ast)).join("\n");
let captured;
const exports = {};
class HttpError extends Error {}
const keyHash = createHash("sha256").update(`fictional-quota-recipe:${randomUUID()}`).digest("hex");
const policy = SUPPORT_RATE_LIMIT_POLICIES.assistantGlobalGuard;
vm.runInNewContext(ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, {
  exports, sql, HttpError,
  db: { execute: async (query) => { captured = new PgDialect().sqlToQuery(query); return [{ scope: policy.scope, key_hash: keyHash }]; } },
});
await exports.enforceSupportRateLimits([{ ...policy, keyHash }]);
assert.equal(captured.params.length, 1);
const params = JSON.parse(captured.params[0]);
assert.equal(params[0].scope, "assistant_global");
assert.equal(params[0].max_count, policy.limit);
assert.ok(!captured.sql.includes("$quota_query$"));

process.stdout.write(`-- Verify a disposable/preview target before running this entire recipe.
begin;
set local statement_timeout = '20s';
set local lock_timeout = '3s';
do $$
declare
  key_hash_fixture text := '${keyHash}';
  parameters jsonb := $parameters$${JSON.stringify(params)}$parameters$::jsonb;
  quota_query text := $quota_query$${captured.sql}$quota_query$;
  result_row record;
  affected integer;
  counter_value integer;
begin
  if not exists (select 1 from pg_class where oid='public.support_rate_limits'::regclass
      and relrowsecurity and relforcerowsecurity)
    or has_table_privilege('anon', 'public.support_rate_limits', 'SELECT,INSERT,UPDATE,DELETE')
    or has_table_privilege('authenticated', 'public.support_rate_limits', 'SELECT,INSERT,UPDATE,DELETE') then
    raise exception 'Rate counters must remain server-only with forced RLS';
  end if;
  if exists (select 1 from pg_trigger where tgrelid='public.support_rate_limits'::regclass and not tgisinternal) then
    raise exception 'Review counter triggers before this rollback recipe';
  end if;
  if exists (select 1 from public.support_rate_limits where scope='assistant_global' and key_hash=key_hash_fixture) then
    raise exception 'Synthetic key already exists';
  end if;
  insert into public.support_rate_limits(scope, key_hash, window_started_at, request_count, expires_at)
    values ('assistant_global', key_hash_fixture, now(), ${policy.limit - 1}, now() + interval '1 hour');
  execute quota_query into result_row using parameters;
  get diagnostics affected = row_count;
  if affected <> 1 then raise exception 'Last available slot was denied'; end if;
  execute quota_query into result_row using parameters;
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'Exhausted counter was allowed'; end if;
  select request_count into counter_value from public.support_rate_limits
    where scope='assistant_global' and key_hash=key_hash_fixture;
  if counter_value is distinct from ${policy.limit} then raise exception 'Counter exceeded global ceiling or disappeared'; end if;
  update public.support_rate_limits set window_started_at=now()-interval '2 hours', expires_at=now()-interval '1 second'
    where scope='assistant_global' and key_hash=key_hash_fixture;
  execute quota_query into result_row using parameters;
  get diagnostics affected = row_count;
  if affected <> 1 then raise exception 'Expired window failed to reopen'; end if;
  select request_count into counter_value from public.support_rate_limits
    where scope='assistant_global' and key_hash=key_hash_fixture;
  if counter_value is distinct from 1 then raise exception 'New window did not reset once'; end if;
end;
$$;
select jsonb_build_object('status','passed','global_limit',${policy.limit},'source','actual_enforcer_sql',
  'synthetic_key','${keyHash}','scope','assistant_global') as result;
rollback;
`);
