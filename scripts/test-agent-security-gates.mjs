import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as crypto from "node:crypto";
import vm from "node:vm";
import test from "node:test";
import ts from "typescript";
import React from "react";
import * as jsxRuntime from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";
import * as accessPolicy from "../shared/support-agent-access.ts";
import { AGENT_ROLES } from "../shared/role-access.ts";
import { safeAuthReturnPath } from "../shared/auth-return-path.ts";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const compiled = new Map();
function load(path, dependencies, env) {
  if (!compiled.has(path)) compiled.set(path, ts.transpileModule(read(path), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText);
  const exports = {};
  vm.runInNewContext(compiled.get(path), {
    exports, Buffer, process: { env },
    require: (name) => {
      assert.ok(Object.hasOwn(dependencies, name), `Unexpected dependency ${name}`);
      return dependencies[name];
    },
  }, { filename: path });
  return exports;
}

function fixture(env = {}) {
  const state = {
    user: { id: "fixture-agent", email: "agent@example.invalid", app_metadata: { role: "agent", service_codes: ["direction"] } },
    currentLevel: "aal2", nextLevel: "aal2", authError: false,
    mfaError: false, missingAssurance: false, dbError: false,
    institutionStatus: "pilot", institutionId: "fixture-school",
    membership: { userId: "fixture-agent", institutionId: "fixture-school", role: "agent", serviceCodes: ["ddfpt"], status: "active" },
    calls: { auth: 0, mfa: 0, db: 0 },
  };
  const req = { headers: { authorization: "Bearer fixture-token-not-a-real-jwt" } };
  const auth = load("api/_shared/auth.ts", {
    "node:crypto": crypto,
    "@supabase/supabase-js": { createClient: () => ({ auth: {
      getUser: async (token) => {
        state.calls.auth++;
        assert.equal(token, "fixture-token-not-a-real-jwt");
        return { data: { user: state.user }, error: state.authError ? new Error("fixture-auth-unavailable") : null };
      },
      mfa: { getAuthenticatorAssuranceLevel: async (token) => {
        state.calls.mfa++;
        assert.equal(token, "fixture-token-not-a-real-jwt");
        return {
          data: state.missingAssurance ? null : { currentLevel: state.currentLevel, nextLevel: state.nextLevel },
          error: state.mfaError ? new Error("fixture-provider-private-detail") : null,
        };
      } },
    } }) },
  }, env);
  const membershipColumns = Object.fromEntries(["userId", "institutionId", "role", "serviceCodes", "status"].map((key) => [key, `membership.${key}`]));
  const institutionColumns = { id: "institution.id", status: "institution.status" };
  function value(row, input) { return Object.hasOwn(row, input) ? row[input] : input; }
  const orm = {
    eq: (left, right) => (row) => value(row, left) === value(row, right),
    inArray: (left, values) => (row) => values.includes(value(row, left)),
    and: (...filters) => (row) => filters.every((filter) => filter(row)),
  };
  const db = { select: (projection) => {
    let join = () => true;
    let where = () => true;
    const query = {
      from(table) { assert.equal(table, membershipColumns); return query; },
      innerJoin(table, condition) { assert.equal(table, institutionColumns); join = condition; return query; },
      where(condition) { where = condition; return query; },
      async limit(count) {
        state.calls.db++;
        if (state.dbError) throw new Error("fixture-db-private-detail");
        if (!state.membership) return [];
        const row = Object.fromEntries(Object.entries(state.membership).map(([key, val]) => [`membership.${key}`, val]));
        row["institution.id"] = state.institutionId;
        row["institution.status"] = state.institutionStatus;
        return (join(row) && where(row) ? [Object.fromEntries(Object.entries(projection).map(([key, col]) => [key, row[col]]))] : []).slice(0, count);
      },
    };
    return query;
  } };
  const gate = load("api/_shared/support-agent-access.ts", {
    "drizzle-orm": orm,
    "../../db/index.js": { db },
    "../../db/schema.js": { institutionMemberships: membershipColumns, institutions: institutionColumns },
    "./auth.js": auth,
    "../../shared/support-agent-access.js": accessPolicy,
    "./institution-context.js": { requireConfiguredInstitution: async () => ({ id: "fixture-school" }) },
  }, env);
  return { state, req, auth, gate, run: () => gate.requireSupportAgent(req) };
}

test("the actual agent gate defaults to persisted scope, not elevated profile services", async () => {
  const f = fixture();
  const context = await f.run();
  assert.deepEqual(context.access.serviceCodes, ["ddfpt"]);
  assert.equal(context.institutionId, "fixture-school");
  assert.equal(context.access.canViewAll, false);
  assert.deepEqual(f.state.calls, { auth: 1, mfa: 1, db: 1 });
  assert.throws(() => f.gate.assertSupportRequestAccess(context.access, "direction"), { status: 403 });
});

test("missing or disabled MFA flags never admit an unenrolled agent", async () => {
  for (const oldFlag of [undefined, "false", "FALSE", "", "not-a-boolean", "true"]) {
    const f = fixture(oldFlag === undefined ? {} : { REQUIRE_AGENT_MFA: oldFlag });
    f.state.currentLevel = "aal1";
    f.state.nextLevel = "aal1";
    await assert.rejects(f.run(), { status: 403, message: /Double vérification/ });
    assert.equal(f.state.calls.db, 0);
  }
});

test("an enrolled factor or a profile assurance claim cannot substitute for current AAL2", async () => {
  const f = fixture();
  f.state.currentLevel = "aal1";
  f.state.user.app_metadata.aal = "aal2";
  f.state.user.app_metadata.mfa_verified_at = "2026-09-01T12:00:00Z";
  await assert.rejects(f.run(), { status: 403 });
  for (const invalid of [undefined, null, "AAL2", "aal3"]) {
    f.state.currentLevel = invalid;
    await assert.rejects(f.run(), { status: 403 });
  }
});

test("provider failures or missing assurance fail closed without leaking provider details", async () => {
  for (const mode of ["mfaError", "missingAssurance"]) {
    const f = fixture();
    f.state[mode] = true;
    await assert.rejects(f.run(), (error) => error.status === 503 && !error.message.includes("fixture-"));
    assert.equal(f.state.calls.db, 0);
  }
});

test("identity validation precedes MFA and database access", async () => {
  for (const mode of ["no-header", "bad-token", "deleted-user", "wrong-role", "user-metadata-role"]) {
    const f = fixture();
    if (mode === "no-header") f.req.headers = {};
    if (mode === "bad-token") f.state.authError = true;
    if (mode === "deleted-user") f.state.user = null;
    if (mode === "wrong-role") f.state.user.app_metadata.role = "eleve";
    if (mode === "user-metadata-role") {
      f.state.user.app_metadata = {};
      f.state.user.user_metadata = { role: "superadmin" };
    }
    await assert.rejects(f.run(), (error) => [401, 403].includes(error.status));
    assert.equal(f.state.calls.mfa, 0);
    assert.equal(f.state.calls.db, 0);
  }
});

test("database absence, revocation, foreign institution and foreign user cannot fall back", async () => {
  for (const mode of ["absent", "disabled", "invited", "foreign-school", "foreign-user", "suspended", "archived"]) {
    const f = fixture();
    if (mode === "absent") f.state.membership = null;
    if (["disabled", "invited"].includes(mode)) f.state.membership.status = mode;
    if (mode === "foreign-school") f.state.membership.institutionId = "another-school";
    if (mode === "foreign-user") f.state.membership.userId = "another-agent";
    if (["suspended", "archived"].includes(mode)) f.state.institutionStatus = mode;
    await assert.rejects(f.run(), { status: 403 });
  }
  const f = fixture();
  f.state.dbError = true;
  await assert.rejects(f.run(), (error) => error.status === 503 && !error.message.includes("fixture-"));
});

test("obsolete metadata configuration and unknown sources are explicitly refused", async () => {
  for (const source of ["metadata", "METADATA", "", "profile", "databse"]) {
    const f = fixture({ SUPPORT_MEMBERSHIP_SOURCE: source });
    await assert.rejects(f.run(), { status: 503, message: /source des périmètres/ });
    assert.equal(f.state.calls.db, 0);
  }
  const f = fixture({ SUPPORT_MEMBERSHIP_SOURCE: " DATABASE " });
  assert.equal((await f.run()).access.canViewAll, false);
});

test("every privileged role needs AAL2, and global roles still need an admin membership", async () => {
  for (const role of ["superadmin", "proviseur", "administration", "agent"]) {
    const f = fixture({ REQUIRE_AGENT_MFA: "false" });
    f.state.user.app_metadata.role = role;
    f.state.currentLevel = "aal1";
    await assert.rejects(f.run(), { status: 403, message: /Double vérification/ });
    f.state.currentLevel = "aal2";
    if (["superadmin", "proviseur"].includes(role)) {
      await assert.rejects(f.run(), { status: 403 });
      f.state.membership.role = "admin";
      assert.equal((await f.run()).access.canViewAll, true);
    } else assert.equal((await f.run()).access.canViewAll, false);
  }
});

test("membership and MFA changes are rechecked on the next request without cached grants", async () => {
  const f = fixture();
  await f.run();
  f.state.membership.status = "disabled";
  await assert.rejects(f.run(), { status: 403 });
  f.state.membership.status = "active";
  f.state.membership.serviceCodes = ["vie_scolaire"];
  assert.deepEqual((await f.run()).access.serviceCodes, ["vie_scolaire"]);
  f.state.currentLevel = "aal1";
  await assert.rejects(f.run(), { status: 403, message: /Double vérification/ });
});

test("ordinary student and teacher authorization does not acquire an agent MFA requirement", async () => {
  for (const role of ["eleve", "professeur", "pp"]) {
    const f = fixture();
    f.state.user.app_metadata.role = role;
    f.state.currentLevel = "aal1";
    const user = await f.auth.requireRole(f.req, [role]);
    assert.equal(user.role, role);
    assert.equal(f.state.calls.mfa, 0);
  }
});

test("the public shell and enrollment remain reachable, with an explicit security route", () => {
  const app = read("src/App.tsx");
  assert.doesNotMatch(app, /AGENT_MFA_ENFORCED|nextAssuranceLevel/);
  assert.match(app, /isAgentRole\(user\.role\)\s*&&\s*assuranceLevel !== "aal2"/);
  assert.match(app, /path="\/security"[\s\S]*?<SignedInRoute>[\s\S]*?<MfaSecurityPage/);
  assert.match(app, /path="\/" element=\{<LyceeConnectPrototype \/>\}/);
  const mfa = read("src/pages/MfaSecurityPage.tsx");
  assert.match(mfa, /to=\{isVerifiedNow \? returnTo : "\/"\}/);
  assert.doesNotMatch(mfa, /Cette session peut accéder aux dossiers sensibles/);
  const consolePage = read("src/pages/prototype/LyceeConnectPrototype.tsx");
  assert.match(consolePage, /double vérification\|vérification renforcée/);
  assert.match(consolePage, /href="\/security\?returnTo=%2Fprototype%3Fview%3Dagent"/);
});

test("the real route guards send AAL1 staff to enrollment while keeping enrollment and other roles reachable", () => {
  const ast = ts.createSourceFile("App.tsx", read("src/App.tsx"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const names = new Set(["ProtectedRoute", "SignedInRoute", "PageFallback"]);
  const functions = ast.statements.filter((node) => ts.isFunctionDeclaration(node) && names.has(node.name?.text));
  assert.equal(functions.length, 3);
  const output = ts.transpileModule(functions.map((node) => `export ${node.getText(ast)}`).join("\n"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  let session = { user: null, loading: false, assuranceLevel: "aal1", nextAssuranceLevel: "aal1" };
  const exports = {};
  vm.runInNewContext(output, {
    exports,
    require: (name) => { assert.equal(name, "react/jsx-runtime"); return jsxRuntime; },
    useAuth: () => session,
    useLocation: () => ({ pathname: "/admin/contenus", search: "?draft=fixture" }),
    isAgentRole: (role) => AGENT_ROLES.includes(role),
    Navigate: ({ to }) => React.createElement("a", { href: to }, "redirect"),
  });
  const child = React.createElement("p", null, "private-content-fixture");
  const render = (route) => renderToStaticMarkup(React.createElement(exports[route], null, child));
  assert.match(render("ProtectedRoute"), /\/login\?returnTo=%2Fadmin%2Fcontenus%3Fdraft%3Dfixture&amp;mode=staff/);
  for (const role of AGENT_ROLES) {
    session = { user: { role }, loading: false, assuranceLevel: "aal1", nextAssuranceLevel: "aal1" };
    assert.match(render("ProtectedRoute"), /\/security\?returnTo=%2Fadmin%2Fcontenus%3Fdraft%3Dfixture/);
    assert.doesNotMatch(render("ProtectedRoute"), /private-content-fixture/);
    assert.match(render("SignedInRoute"), /private-content-fixture/);
    session.assuranceLevel = "aal2";
    assert.match(render("ProtectedRoute"), /private-content-fixture/);
  }
  for (const role of ["eleve", "professeur", "pp"]) {
    session = { user: { role }, loading: false, assuranceLevel: "aal1", nextAssuranceLevel: "aal1" };
    assert.match(render("ProtectedRoute"), /private-content-fixture/);
  }
  session = { user: { role: "agent" }, loading: true, assuranceLevel: "aal2" };
  assert.doesNotMatch(render("ProtectedRoute"), /private-content-fixture/);
});

test("login and MFA return paths cannot escape the application through browser URL normalization", () => {
  for (const value of [null, {}, "https://outside.invalid", "//outside.invalid", "/\\outside.invalid", "/a/..//outside.invalid", "/%2e%2e//outside.invalid", "/\t/outside.invalid", "/\n/outside.invalid", "/\r/outside.invalid", "/\u0000/outside.invalid", "javascript:alert(1)", " /admin", "/" + "a".repeat(2048)]) {
    assert.equal(safeAuthReturnPath(value), null, String(value));
  }
  for (const value of ["/", "/admin/contenus?draft=fixture#piece", "/prototype?view=agent", "/security", "/contenus/une%20page"]) {
    assert.equal(safeAuthReturnPath(value), value);
  }
  assert.equal(safeAuthReturnPath("/admin/../prototype?view=agent"), "/prototype?view=agent");
  for (const path of ["src/pages/LoginPage.tsx", "src/pages/MfaSecurityPage.tsx"]) {
    assert.match(read(path), /safeAuthReturnPath\(/);
  }
});
