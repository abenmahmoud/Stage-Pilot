import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import ts from "typescript";
import { drizzle } from "drizzle-orm/postgres-js";
import * as orm from "drizzle-orm";

// Generate SQL only. All table names are shadowed by fictitious CTEs; no connection.
const require = createRequire(import.meta.url);
function compile(path, dependencies, clock = Date) {
  const source = readFileSync(new URL(path, import.meta.url), "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports = {};
  vm.runInNewContext(output, { exports, Date: clock, require: dependencies });
  return exports;
}
const schema = compile("../db/schema.ts", (name) => {
  assert.ok(["drizzle-orm", "drizzle-orm/pg-core"].includes(name)); return require(name);
});
const SCHOOL = "10000000-0000-4000-8000-000000000001";
const USER = "20000000-0000-4000-8000-000000000001";
const IDENTITY = "30000000-0000-4000-8000-000000000001";
const IMPORT = "40000000-0000-4000-8000-000000000001";
const OTHER = "90000000-0000-4000-8000-000000000001";
class Clock extends Date { constructor(...args) { super(...(args.length ? args : ["2026-09-01T12:00:00Z"])); } }
const knownIdentity = {
  id: IDENTITY, sourceImportId: IMPORT, personType: "guardian", officialPersonRef: "GUARDIAN-001",
  assuranceLevel: "directory_matched", verifiedBy: USER, verifiedAt: new Date("2026-08-31T12:00:00Z"),
};
const responses = [[knownIdentity], [{ personType: "guardian", classRef: null }], [{ id: OTHER }],
  [{ personType: "student", classRef: "CLASS-001" }], [{ objectRef: "GROUP-001" }]];
const queries = [];
const mock = drizzle.mock();
function wrap(query) {
  return new Proxy(query, { get(target, name) {
    if (name === "limit") return async (limit) => {
      queries.push(target.limit(limit).toSQL());
      assert.ok(responses.length > 0, "unexpected new query must extend the recipe"); return responses.shift();
    };
    const member = Reflect.get(target, name);
    return typeof member === "function" ? (...args) => wrap(member.apply(target, args)) : member;
  } });
}
const db = { select: (projection) => wrap(mock.select(projection)), async transaction(run, config) {
  assert.deepEqual({ ...config }, { isolationLevel: "repeatable read", accessMode: "read only" }); return run(db);
} };
const dependencies = {
  "drizzle-orm": orm, "../../db/index.js": { db }, "../../db/schema.js": schema,
  "./auth.js": { HttpError: Error, requireUser: async () => ({ id: USER }) },
  "./institution-context.js": { requireConfiguredInstitution: async () => ({ id: SCHOOL }) },
  "./schedule-reader.js": {},
};
const reader = compile("../api/_shared/schedule-identity-reader.ts", (name) => {
  assert.ok(Object.hasOwn(dependencies, name)); return dependencies[name];
}, Clock);
await reader.resolveVerifiedScheduleScope({ headers: {} }, "CHILD-001");
assert.equal(queries.length, 5); assert.equal(responses.length, 0);

const tables = {
  school_identities: { definition: schema.schoolIdentities, keys: ["id", "institutionId", "userId", "sourceImportId", "personType", "officialPersonRef", "revokedAt", "assuranceLevel", "verifiedBy", "verifiedAt"] },
  identity_directory_imports: { definition: schema.identityDirectoryImports, keys: ["id", "institutionId", "status"] },
  school_relationships: { definition: schema.schoolRelationships, keys: ["id", "institutionId", "subjectIdentityId", "sourceImportId", "objectPersonRef", "relationshipType", "status", "validFrom", "validUntil"] },
  identity_directory_rows: { definition: schema.identityDirectoryRows, keys: ["institutionId", "importId", "recordType", "personRef", "personType", "classRef", "subjectPersonRef", "relationshipType", "objectRef", "validationStatus", "validFrom", "validUntil"] },
};
const basePerson = { institutionId: SCHOOL, importId: IMPORT, recordType: "person", personRef: "GUARDIAN-001", personType: "guardian",
  classRef: null, subjectPersonRef: null, relationshipType: null, objectRef: null, validationStatus: "valid", validFrom: "2026-08-01", validUntil: "2027-07-01" };
const base = {
  school_identities: [{ ...knownIdentity, institutionId: SCHOOL, userId: USER, revokedAt: null }],
  identity_directory_imports: [{ id: IMPORT, institutionId: SCHOOL, status: "active" }],
  school_relationships: [{ id: OTHER, institutionId: SCHOOL, subjectIdentityId: IDENTITY, sourceImportId: IMPORT,
    objectPersonRef: "CHILD-001", relationshipType: "guardian_of", status: "active", validFrom: "2026-08-01", validUntil: "2027-07-01" }],
  identity_directory_rows: [basePerson, { ...basePerson, personRef: "CHILD-001", personType: "student", classRef: "CLASS-001" },
    { ...basePerson, recordType: "relationship", personRef: null, personType: null, subjectPersonRef: "CHILD-001", relationshipType: "member_of", objectRef: "GROUP-001" }],
};
const cases = [];
function add(name, index, expected, mutate = () => {}) {
  const data = structuredClone(base); mutate(data); cases.push({ name, index, expected, data });
}
for (let index = 0; index < 5; index++) add(`valid-query-${index}`, index, 1);
for (const [field, changed] of [["userId", OTHER], ["institutionId", OTHER], ["sourceImportId", OTHER], ["revokedAt", "2026-09-01T00:00:00Z"]]) {
  add(`identity-${field}`, 0, 0, (d) => { d.school_identities[0][field] = changed; });
}
add("inactive-source", 0, 0, (d) => { d.identity_directory_imports[0].status = "superseded"; });
add("foreign-source", 0, 0, (d) => { d.identity_directory_imports[0].institutionId = OTHER; });
add("identity-ambiguity-visible", 0, 2, (d) => { d.school_identities.push({ ...d.school_identities[0], id: OTHER, personType: "staff" }); });
for (const [field, changed] of [["subjectIdentityId", OTHER], ["institutionId", OTHER], ["sourceImportId", OTHER], ["objectPersonRef", "OTHER-CHILD"],
  ["relationshipType", "teaches"], ["status", "revoked"], ["validUntil", "2026-08-31"], ["validFrom", "2026-09-02"]]) {
  add(`relationship-${field}`, 2, 0, (d) => { d.school_relationships[0][field] = changed; });
}
for (const [field, changed] of [["institutionId", OTHER], ["importId", OTHER], ["validationStatus", "invalid"], ["validFrom", "2026-09-02"], ["validUntil", "2026-08-31"]]) {
  add(`child-${field}`, 3, 0, (d) => { d.identity_directory_rows[1][field] = changed; });
}
add("child-ambiguity-visible", 3, 2, (d) => { d.identity_directory_rows.push({ ...d.identity_directory_rows[1] }); });
add("groups-overflow-visible", 4, 41, (d) => {
  const membership = d.identity_directory_rows.pop();
  d.identity_directory_rows.push(...Array.from({ length: 42 }, (_, i) => ({ ...membership, objectRef: `GROUP-${i}` })));
});
add("group-foreign-source", 4, 0, (d) => { d.identity_directory_rows[2].importId = OTHER; });
add("group-expired", 4, 0, (d) => { d.identity_directory_rows[2].validUntil = "2026-08-31"; });
add("inclusive-validity-day", 2, 1, (d) => { d.school_relationships[0].validFrom = "2026-09-01"; d.school_relationships[0].validUntil = "2026-09-01"; });

const literal = (value) => {
  if (value === null) return "null";
  if (typeof value === "number") { assert.ok(Number.isFinite(value)); return String(value); }
  assert.equal(typeof value, "string"); return `'${value.replaceAll("'", "''")}'`;
};
const selects = cases.map(({ name, index, expected, data }) => {
  const { sql, params } = queries[index];
  assert.doesNotMatch(sql, /;|\b(?:insert|update|delete|public)\b/i);
  const names = [...sql.matchAll(/\b(?:from|join) "([^"]+)"/g)].map((match) => match[1]);
  assert.ok(names.length > 0 && names.every((name) => Object.hasOwn(tables, name)), "all physical tables must be shadowed");
  const bound = sql.replace(/\$(\d+)\b/g, (_, number) => literal(params[Number(number) - 1]));
  const ctes = [...new Set(names)].map((name) => {
    const { definition, keys } = tables[name];
    const records = data[name].map((row) => Object.fromEntries(keys.map((key) => [definition[key].name, row[key] ?? null])));
    const fields = keys.map((key) => `"${definition[key].name}" ${definition[key].getSQLType()}`).join(",");
    return `"${name}" as (select * from jsonb_to_recordset(${literal(JSON.stringify(records))}) as fixture(${fields}))`;
  });
  return `select ${literal(name)} as name, ${expected} as expected, count(*)::integer as actual from (with ${ctes.join(",")} ${bound}) checked`;
});
console.log(`begin isolation level repeatable read read only;
set local statement_timeout = '15s';
select count(*)::integer as cases, count(*) filter (where expected = actual)::integer as passed,
coalesce(jsonb_agg(name) filter (where expected <> actual), '[]'::jsonb) as failures
from (${selects.join("\nunion all\n")}) results;
rollback;`);
