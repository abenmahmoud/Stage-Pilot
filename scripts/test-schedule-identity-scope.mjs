import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const source = readFileSync(new URL("../api/_shared/schedule-identity-reader.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const NOW = new Date("2026-09-01T12:00:00Z");
class FixedDate extends Date {
  constructor(...args) { super(...(args.length ? args : [NOW.getTime()])); }
  static now() { return NOW.getTime(); }
}
class HttpError extends Error { constructor(status, message) { super(message); this.status = status; } }
const table = (name, keys) => Object.fromEntries(keys.map((key) => [key, { table: name, key }]));
const schema = {
  schoolIdentities: table("identities", ["id", "institutionId", "userId", "sourceImportId", "personType", "officialPersonRef", "revokedAt", "assuranceLevel", "verifiedBy", "verifiedAt"]),
  identityDirectoryImports: table("imports", ["id", "institutionId", "status"]),
  schoolRelationships: table("relationships", ["id", "institutionId", "subjectIdentityId", "sourceImportId", "objectPersonRef", "relationshipType", "status", "validFrom", "validUntil"]),
  identityDirectoryRows: table("rows", ["id", "institutionId", "importId", "recordType", "personRef", "personType", "classRef", "subjectPersonRef", "relationshipType", "objectRef", "validationStatus", "validFrom", "validUntil"]),
};
const tableName = (value) => Object.values(value)[0].table;
const value = (row, operand) => operand?.table ? row[operand.table]?.[operand.key] : operand;
const compare = (a, b, fn) => (row) => {
  const left = value(row, a), right = value(row, b);
  return left != null && right != null && fn(left, right);
};
const orm = {
  eq: (a, b) => compare(a, b, (x, y) => x === y),
  gte: (a, b) => compare(a, b, (x, y) => x >= y),
  lte: (a, b) => compare(a, b, (x, y) => x <= y),
  isNull: (col) => (row) => value(row, col) === null,
  and: (...filters) => (row) => filters.every((filter) => filter(row)),
  or: (...filters) => (row) => filters.some((filter) => filter(row)),
};
const identity = (extra = {}) => ({
  id: "identity-fixture", institutionId: "school-fixture", userId: "user-fixture", sourceImportId: "import-fixture",
  personType: "student", officialPersonRef: "STUDENT-001", revokedAt: null,
  assuranceLevel: "directory_matched", verifiedBy: "agent-fixture", verifiedAt: new Date("2026-08-31T12:00:00Z"), ...extra,
});
const person = (extra = {}) => ({
  id: "person-fixture", institutionId: "school-fixture", importId: "import-fixture", recordType: "person",
  personRef: "STUDENT-001", personType: "student", classRef: "CLASS-001", subjectPersonRef: null,
  relationshipType: null, objectRef: null, validationStatus: "valid", validFrom: "2026-08-01", validUntil: "2027-07-01", ...extra,
});
const group = (extra = {}) => ({ ...person(), id: "group-fixture", recordType: "relationship", personRef: null,
  personType: null, classRef: null, subjectPersonRef: "STUDENT-001", relationshipType: "member_of", objectRef: "GROUP-001", ...extra });
const relationship = (extra = {}) => ({
  id: "relationship-fixture", institutionId: "school-fixture", subjectIdentityId: "identity-fixture", sourceImportId: "import-fixture",
  objectPersonRef: "CHILD-001", relationshipType: "guardian_of", status: "active", validFrom: "2026-08-01", validUntil: "2027-07-01", ...extra,
});

function fixture() {
  const state = { user: { id: "user-fixture" }, institutionId: "school-fixture", readCalls: [], queries: [], transactions: [],
    deviceIdentity: null, dbFailure: false, afterQuery: null, data: { identities: [identity()],
      imports: [{ id: "import-fixture", institutionId: "school-fixture", status: "active" }], relationships: [], rows: [person(), group()] } };
  // Evaluate all joins and predicates; fixtures are not pre-filtered answers.
  function reader(getData) {
    return { select(projection) {
      let base;
      const joins = [], filters = [];
      const query = {
        from(input) { base = tableName(input); return query; },
        innerJoin(input, filter) { joins.push({ name: tableName(input), filter }); return query; },
        where(filter) { filters.push(filter); return query; },
        async limit(count) {
          if (state.dbFailure) throw new Error("synthetic-database-failure");
          const data = getData();
          let rows = data[base].map((item) => ({ [base]: item }));
          for (const join of joins) rows = rows.flatMap((row) => data[join.name]
            .map((item) => ({ ...row, [join.name]: item })).filter(join.filter));
          const result = rows.filter((row) => filters.every((filter) => filter(row))).slice(0, count)
            .map((row) => Object.fromEntries(Object.entries(projection).map(([key, col]) => [key, value(row, col)])));
          state.queries.push({ base, limit: count }); state.afterQuery?.(state.queries.length);
          return result;
        },
      };
      return query;
    } };
  }
  const db = { ...reader(() => state.data), async transaction(run, config) {
    state.transactions.push(structuredClone(config));
    assert.equal(config?.isolationLevel, "repeatable read"); assert.equal(config?.accessMode, "read only");
    const snapshot = structuredClone(state.data);
    return run(reader(() => snapshot));
  } };
  const dependencies = {
    "drizzle-orm": orm, "../../db/index.js": { db }, "../../db/schema.js": schema,
    "./auth.js": { HttpError, requireUser: async () => {
      if (!state.user) throw new HttpError(401, "Authentication required"); return state.user;
    } },
    "./institution-context.js": { requireConfiguredInstitution: async () => ({ id: state.institutionId }) },
    "./identity-device-access.js": { readIdentityDeviceSession: async () => state.deviceIdentity },
    "./schedule-reader.js": { readNextCourseFromPrivateSchedule: async (input) => {
      state.readCalls.push(input); return { ok: false, reason: "no_authorized_course" };
    } },
  };
  const exports = {};
  vm.runInNewContext(compiled, { exports, Date: FixedDate,
    require: (name) => { assert.ok(Object.hasOwn(dependencies, name), name); return dependencies[name]; } });
  return { state,
    resolve: async (target) => structuredClone(await exports.resolveVerifiedScheduleScope({ headers: {} }, target)),
    read: (target) => exports.readNextCourseForVerifiedIdentity({ req: { headers: {} }, targetPersonRef: target, now: NOW, requestedAt: NOW }),
  };
}
function guardianFixture() {
  const f = fixture();
  f.state.data.identities = [identity({ personType: "guardian", officialPersonRef: "GUARDIAN-001" })];
  f.state.data.rows = [person({ personRef: "GUARDIAN-001", personType: "guardian", classRef: null }),
    person({ id: "child-fixture", personRef: "CHILD-001", classRef: "CHILD-CLASS" }),
    group({ subjectPersonRef: "CHILD-001", objectRef: "CHILD-GROUP" }), group({ objectRef: "UNRELATED-GROUP" })];
  f.state.data.relationships = [relationship()]; return f;
}
const studentScope = { institutionId: "school-fixture", identityLevel: "I3", authorizedClassRefs: ["CLASS-001"], authorizedGroupRefs: ["GROUP-001"], authorizedTeacherRefs: [] };
async function deniedAfter(change, make = fixture, target) {
  const f = make(); change(f.state.data);
  await assert.rejects(f.read(target), { status: 403 }); assert.equal(f.state.readCalls.length, 0);
}

test("student gets only own class/groups using a read-only coherent snapshot", async () => {
  const f = fixture(); f.state.data.rows.push(person({ personRef: "OTHER-001", classRef: "OTHER-CLASS" }), group({ subjectPersonRef: "OTHER-001", objectRef: "OTHER-GROUP" }));
  assert.deepEqual(await f.resolve(), studentScope); assert.deepEqual(await f.resolve("STUDENT-001"), studentScope);
  assert.equal(f.state.transactions.length, 2);
});
test("email-verified device identity gets the same own-student scope without an account", async () => {
  const f = fixture();
  f.state.user = null;
  f.state.deviceIdentity = {
    sourceImportId: "import-fixture", personRef: "STUDENT-001",
    personType: "student", assuranceLevel: "directory_email_otp",
  };
  assert.deepEqual(await f.resolve(), studentScope);
});
test("email-verified guardian needs an active directory relationship for the selected child", async () => {
  const f = guardianFixture();
  f.state.user = null;
  f.state.deviceIdentity = {
    sourceImportId: "import-fixture", personRef: "GUARDIAN-001",
    personType: "guardian", assuranceLevel: "directory_email_otp",
  };
  f.state.data.relationships = [];
  f.state.data.rows.push(group({
    id: "guardian-link-fixture", subjectPersonRef: "GUARDIAN-001",
    relationshipType: "guardian_of", objectRef: "CHILD-001",
  }));
  assert.deepEqual(await f.resolve("CHILD-001"), {
    institutionId: "school-fixture", identityLevel: "I3",
    authorizedClassRefs: ["CHILD-CLASS"], authorizedGroupRefs: ["CHILD-GROUP"],
    authorizedTeacherRefs: [],
  });
});
test("requires authentication and ignores public identity claims", async () => {
  const f = fixture(); f.state.user = null;
  await assert.rejects(f.read(), { status: 401 }); assert.equal(f.state.queries.length, 0);
  f.state.user = { id: "unknown-user", user_metadata: { officialPersonRef: "STUDENT-001", identityLevel: "I4" } };
  await assert.rejects(f.read(), { status: 403 }); assert.equal(f.state.readCalls.length, 0);
});
test("rejects revoked, foreign, unverified, future and ambiguous identities", async () => {
  for (const override of [{ revokedAt: NOW }, { institutionId: "foreign-school" }, { sourceImportId: "missing-import" },
    { assuranceLevel: "contact_verified" }, { verifiedBy: null }, { verifiedAt: new Date("2026-09-02T00:00:00Z") }]) {
    await deniedAfter((d) => Object.assign(d.identities[0], override));
  }
  await deniedAfter((d) => { d.identities = []; });
  await deniedAfter((d) => { d.imports[0].institutionId = "foreign-school"; });
  await deniedAfter((d) => { d.identities.push(identity({ id: "second-identity", personType: "staff", officialPersonRef: "STAFF-001" })); });
  const f = fixture(); Object.assign(f.state.data.identities[0], { assuranceLevel: "official_sso", verifiedBy: null });
  assert.deepEqual(await f.resolve(), studentScope);
});
test("identity needs one matching, current, valid person row, not just a group membership", async () => {
  for (const override of [{ validUntil: "2026-08-31" }, { validFrom: "2026-09-02" }, { validFrom: null },
    { validationStatus: "invalid" }, { personType: "staff" }, { institutionId: "foreign-school" }, { importId: "old-import" }]) {
    await deniedAfter((d) => Object.assign(d.rows[0], override));
  }
  await deniedAfter((d) => { d.rows = d.rows.filter((row) => row.recordType !== "person"); });
  await deniedAfter((d) => { d.rows.push(person({ id: "duplicate-person", classRef: "OTHER-CLASS" })); });
});
test("parent reads each explicitly selected authorized child without merging siblings", async () => {
  const f = guardianFixture();
  f.state.data.rows.push(person({ id: "second-child", personRef: "CHILD-002", classRef: "SECOND-CLASS" }));
  f.state.data.relationships.push(relationship({ id: "second-relation", objectPersonRef: "CHILD-002" }));
  assert.deepEqual(await f.resolve("CHILD-001"), { ...studentScope, authorizedClassRefs: ["CHILD-CLASS"], authorizedGroupRefs: ["CHILD-GROUP"] });
  assert.deepEqual(await f.resolve("CHILD-002"), { ...studentScope, authorizedClassRefs: ["SECOND-CLASS"], authorizedGroupRefs: [] });
  await assert.rejects(f.resolve("OTHER-001"), { status: 403 });
});
test("guardian links must match identity, child, school, source, type, status and dates", async () => {
  for (const override of [{ subjectIdentityId: "other-identity" }, { objectPersonRef: "OTHER-001" }, { institutionId: "foreign-school" },
    { sourceImportId: "old-import" }, { relationshipType: "teaches" }, { relationshipType: "member_of" },
    { status: "revoked" }, { status: "expired" }, { validFrom: "2026-09-02" }, { validUntil: "2026-08-31" }]) {
    await deniedAfter((d) => Object.assign(d.relationships[0], override), guardianFixture, "CHILD-001");
  }
});
test("relationship cannot bypass expired parent/child or expose a third-party staff schedule", async () => {
  for (const change of [(d) => { d.rows[0].validUntil = "2026-08-31"; }, (d) => { d.rows[1].validUntil = "2026-08-31"; },
    (d) => { d.rows[1].personType = "staff"; }, (d) => { d.rows[1].personType = "guardian"; },
    (d) => { d.rows.splice(1, 1); }, (d) => { d.rows.push(person({ id: "duplicate-child", personRef: "CHILD-001" })); }]) {
    await deniedAfter(change, guardianFixture, "CHILD-001");
  }
});
test("staff get only their own teacher scope, with a current staff record", async () => {
  const f = fixture(); f.state.data.identities[0] = identity({ personType: "staff", officialPersonRef: "STAFF-001" });
  f.state.data.rows = [person({ personRef: "STAFF-001", personType: "staff" }), group({ subjectPersonRef: "STAFF-001" })];
  assert.deepEqual(await f.resolve(), { ...studentScope, authorizedClassRefs: [], authorizedGroupRefs: [], authorizedTeacherRefs: ["STAFF-001"] });
  f.state.data.rows[0].validUntil = "2026-08-31"; await assert.rejects(f.read(), { status: 403 });
});
test("a parent never gets a child selected implicitly", async () => { await deniedAfter(() => {}, guardianFixture); });
test("validity boundaries include the recorded day", async () => {
  const f = guardianFixture();
  for (const row of [...f.state.data.rows, ...f.state.data.relationships]) { row.validFrom = "2026-09-01"; row.validUntil = "2026-09-01"; }
  assert.deepEqual((await f.resolve("CHILD-001")).authorizedGroupRefs, ["CHILD-GROUP"]);
});
test("groups stay within the target, school, source, validation and dates, without silent truncation", async () => {
  const f = fixture();
  const overrides = [{ subjectPersonRef: "OTHER-001" }, { institutionId: "foreign-school" }, { importId: "old-import" },
    { validationStatus: "invalid" }, { relationshipType: "teaches" }, { validFrom: "2026-09-02" }, { validUntil: "2026-08-31" }];
  f.state.data.rows.push(...overrides.map((extra, i) => group({ id: `bad-group-${i}`, objectRef: `BAD-GROUP-${i}`, ...extra })));
  assert.deepEqual(await f.resolve(), studentScope);
  f.state.data.rows = [person(), ...Array.from({ length: 40 }, (_, i) => group({ id: `group-${i}`, objectRef: `GROUP-${i}` }))];
  assert.equal((await f.resolve()).authorizedGroupRefs.length, 40);
  f.state.data.rows.push(group({ id: "overflow", objectRef: "GROUP-OVERFLOW" }));
  await assert.rejects(f.read(), { status: 403 }); assert.equal(f.state.readCalls.length, 0);
});
test("inactive versions never provide an identity scope", async () => {
  for (const status of ["reserved", "review", "approved", "superseded", "retired", "failed"]) await deniedAfter((d) => { d.imports[0].status = status; });
});
test("does not transform references into another person's identifier or schedule scope", async () => {
  for (const target of [" STUDENT-001 ", "\uff33TUDENT-001", "STUDENT-001\n", "", null, [], "x".repeat(121)]) {
    const f = fixture(); await assert.rejects(f.read(target), { status: 400 }); assert.equal(f.state.readCalls.length, 0);
  }
  for (const ref of ["class-001", " CLASS-001 ", "\uff23LASS-001", "X".repeat(81)]) await deniedAfter((d) => { d.rows[0].classRef = ref; });
});
test("pins the source snapshot and observes revocation on the next call", async () => {
  const f = fixture(); f.state.afterQuery = (number) => { if (number === 1) f.state.data.imports[0].status = "superseded"; };
  assert.deepEqual(await f.resolve(), studentScope); await assert.rejects(f.read(), { status: 403 }); assert.equal(f.state.readCalls.length, 0);
});
test("database errors cannot fall back to a private reader call", async () => {
  const f = fixture(); f.state.dbFailure = true; await assert.rejects(f.read(), /synthetic-database-failure/); assert.equal(f.state.readCalls.length, 0);
});
test("only derived scope reaches the private reader, never identity or contact records", async () => {
  const f = fixture(); await f.read(); assert.equal(f.state.readCalls.length, 1);
  assert.deepEqual(structuredClone(f.state.readCalls[0].scope), studentScope);
  assert.doesNotMatch(JSON.stringify(f.state.readCalls[0]), /user-fixture|identity-fixture|import-fixture|personRef|verifiedBy|email|phone/);
});
