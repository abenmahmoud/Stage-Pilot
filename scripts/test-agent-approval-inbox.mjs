import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  approvalIsExpired,
  canDecideAgentApproval,
  parseAgentApprovalDecision,
  presentAgentActionInput,
  resolveAgentApprovalRole,
} from "../shared/agent-approval-input.ts";

const root = new URL("../", import.meta.url);
const paths = {
  migration: new URL(
    "../supabase/migrations/20260830004931_add_agent_approval_service_scope.sql",
    import.meta.url
  ),
  expiryMigration: new URL(
    "../supabase/migrations/20260830010418_expire_agent_approvals_in_inbox.sql",
    import.meta.url
  ),
  transitionMigration: new URL(
    "../supabase/migrations/20260830011016_allow_expire_approved_agent_approvals.sql",
    import.meta.url
  ),
  helper: new URL("../api/_shared/agent-approvals.ts", import.meta.url),
  list: new URL("../api/support/agent/approvals/index.ts", import.meta.url),
  decision: new URL(
    "../api/support/agent/approvals/[id]/decision.ts",
    import.meta.url
  ),
  page: new URL("../src/pages/admin/AgentApprovalsPage.tsx", import.meta.url),
  layout: new URL("../src/components/AppLayout.tsx", import.meta.url),
  app: new URL("../src/App.tsx", import.meta.url),
};

const [migration, expiryMigration, transitionMigration, helper, list, decision, page, layout, app] = await Promise.all(
  Object.values(paths).map((path) => readFile(path, "utf8"))
);

test("accepts only a closed and bounded human decision", () => {
  assert.deepEqual(parseAgentApprovalDecision({ decision: "approved", reason: null }), {
    decision: "approved",
    reason: null,
  });
  assert.deepEqual(
    parseAgentApprovalDecision({ decision: "rejected", reason: "  Donnée à corriger  " }),
    { decision: "rejected", reason: "Donnée à corriger" }
  );
  assert.throws(
    () => parseAgentApprovalDecision({ decision: "rejected", reason: "" }),
    /Expliquez/
  );
  assert.throws(
    () => parseAgentApprovalDecision({ decision: "approved", role: "superadmin" }),
    /champ interdit/
  );
  assert.throws(
    () => parseAgentApprovalDecision({ decision: "approved", reason: "a" }),
    /entre 2 et 500/
  );
});

test("derives the decision role from persisted auth and membership roles", () => {
  assert.equal(resolveAgentApprovalRole("superadmin", "admin"), "superadmin");
  assert.equal(resolveAgentApprovalRole("proviseur", "admin"), "direction");
  assert.equal(resolveAgentApprovalRole("agent", "service_manager"), "service_manager");
  assert.equal(resolveAgentApprovalRole("administration", "agent"), "staff");
  assert.equal(resolveAgentApprovalRole("agent", "auditor"), null);
  assert.equal(resolveAgentApprovalRole("eleve", "admin"), null);
});

test("requires a live independent decision in the correct role and service", () => {
  const now = new Date("2026-08-30T08:00:00.000Z");
  const base = {
    approvalStatus: "pending",
    expiresAt: new Date("2026-08-30T09:00:00.000Z"),
    requestedFromRole: "service_manager",
    reviewerRole: "service_manager",
    requestedByUserId: "11111111-1111-4111-8111-111111111111",
    reviewerUserId: "22222222-2222-4222-8222-222222222222",
    serviceCode: "referent_numerique",
    allowedServices: ["referent_numerique"],
    canViewAll: false,
    now,
  };
  assert.equal(canDecideAgentApproval(base), true);
  assert.equal(
    canDecideAgentApproval({ ...base, reviewerUserId: base.requestedByUserId }),
    false
  );
  assert.equal(
    canDecideAgentApproval({ ...base, reviewerRole: "staff" }),
    false
  );
  assert.equal(
    canDecideAgentApproval({ ...base, allowedServices: ["vie_scolaire"] }),
    false
  );
  assert.equal(
    approvalIsExpired("pending", new Date("2026-08-30T07:59:59.000Z"), now),
    true
  );
});

test("presents only allow-listed redacted fields", () => {
  const details = presentAgentActionInput({
    summary: "Préparer une réponse officielle",
    requestCode: "BC-TEST-0001",
    password: "secret",
    rawEmail: "personne@example.test",
  });
  assert.deepEqual(details, [
    { label: "Action préparée", value: "Préparer une réponse officielle" },
    { label: "Dossier", value: "BC-TEST-0001" },
  ]);
  assert.doesNotMatch(JSON.stringify(details), /secret|personne@example/i);
});

test("binds an immutable service scope to every action", () => {
  assert.match(migration, /add column service_code text/i);
  assert.match(migration, /alter column service_code set not null/i);
  assert.match(migration, /agent_actions_service_code_check/i);
  assert.match(migration, /Agent action service scope is immutable/i);
  assert.match(migration, /institution_id,[\s\n]+service_code,[\s\n]+status/i);
  assert.doesNotMatch(migration, /default ['"]administration['"]/i);
});

test("decides under fixed row locks with role, service, expiry and independence checks", () => {
  const actionLock = migration.indexOf("from public.agent_actions as action_record");
  const approvalLock = migration.indexOf("from public.agent_approvals as approval_record", actionLock);
  assert.ok(actionLock >= 0);
  assert.ok(approvalLock > actionLock);
  assert.match(migration, /locked_action\.service_code = any/i);
  assert.match(migration, /locked_approval\.requested_from_role <> expected_decision_role/i);
  assert.match(migration, /locked_approval\.requested_by_user_id = deciding_user_id/i);
  assert.match(migration, /locked_approval\.expires_at <= decision_timestamp/i);
  assert.match(migration, /requested_decision = 'rejected'[\s\S]+status = 'refused'/i);
  assert.match(migration, /security invoker[\s\S]+set search_path = ''/i);
  assert.match(migration, /revoke all on function public\.agent_decide_approval[\s\S]+from public, anon, authenticated/i);
  assert.doesNotMatch(migration, /security definer/i);
});

test("persists and audits inbox expiry under the reviewer's service scope", () => {
  const actionLock = expiryMigration.indexOf(
    "from public.agent_actions as action_record"
  );
  const approvalLock = expiryMigration.indexOf(
    "from public.agent_approvals as approval_record",
    actionLock + 1
  );
  assert.ok(actionLock >= 0);
  assert.ok(approvalLock > actionLock);
  assert.match(expiryMigration, /for update of action_record skip locked/i);
  assert.match(expiryMigration, /approval_record\.status in \('pending', 'approved'\)/i);
  assert.match(expiryMigration, /approval_record\.consumed_at is null/i);
  assert.match(expiryMigration, /action_record\.service_code = any/i);
  assert.match(expiryMigration, /set status = 'expired'/i);
  assert.match(expiryMigration, /set status = 'refused'/i);
  assert.match(expiryMigration, /if new\.status = 'expired'[\s\S]+audit_actor := null;[\s\S]+audit_role := 'system'/i);
  assert.match(expiryMigration, /security invoker[\s\S]+set search_path = ''/i);
  assert.match(
    expiryMigration,
    /revoke all on function public\.agent_expire_approvals[\s\S]+from public, anon, authenticated/i
  );
  assert.match(
    expiryMigration,
    /grant execute on function public\.agent_expire_approvals[\s\S]+to service_role/i
  );
  assert.match(list, /select public\.agent_expire_approvals\(/i);
  assert.ok(list.indexOf("agent_expire_approvals") < list.indexOf("const rows = await db"));
  assert.match(
    transitionMigration,
    /old\.status = 'approved'[\s\S]+new\.status = 'expired'[\s\S]+old\.consumed_at is null/i
  );
  assert.match(
    transitionMigration,
    /new\.status = 'expired' and new\.expires_at > transaction_timestamp\(\)/i
  );
  assert.match(
    transitionMigration,
    /revoke all on function public\.agent_validate_approval_transition\(\)[\s\S]+from public, anon, authenticated/i
  );
});

test("requires persisted membership and live MFA before listing or deciding", () => {
  assert.match(helper, /requireSupportAgent\(req\)/);
  assert.match(helper, /requireAal2\(req\)/);
  assert.match(helper, /institutionMemberships\.status, "active"/);
  assert.match(helper, /resolvePersistedSupportAgentAccess/);
  assert.match(helper, /resolveAgentApprovalRole/);
  assert.match(list, /inArray\(agentActions\.serviceCode, context\.access\.serviceCodes\)/);
  assert.match(decision, /context\.decisionRole/);
  assert.match(decision, /context\.access\.serviceCodes/);
  assert.match(decision, /context\.access\.canViewAll/);
  assert.doesNotMatch(decision, /req\.body\.(?:role|service|user|now)/);
});

test("returns a minimal presentation and never the raw action input", () => {
  const responseBlock = list.slice(list.indexOf("return {\n      generatedAt"));
  assert.match(list, /details: presentAgentActionInput\(row\.inputRedacted\)/);
  assert.match(list, /requestedByMe:/);
  assert.doesNotMatch(responseBlock, /inputRedacted|requestedByUserId|decisionByUserId/);
  assert.doesNotMatch(responseBlock, /toolKey|authorityLevel|actionStatus|consumedAt/);
});

test("adds a responsive approval inbox to every staff navigation", () => {
  assert.match(app, /path="admin\/validations-agent"/);
  assert.match(app, /"superadmin", "proviseur", "administration", "agent"/);
  assert.match(layout, /to="\/admin\/validations-agent"/);
  assert.match(page, /xl:grid-cols-\[minmax\(0,0\.9fr\)_minmax\(0,1\.1fr\)\]/);
  assert.match(page, /sm:items-center/);
  assert.match(page, /role="dialog"/);
  assert.match(page, /Aucune validation en attente/);
  assert.doesNotMatch(page, /toolKey|inputRedacted|requestedByUserId/);
});
