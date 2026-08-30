import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  COMMUNICATION_TEMPLATE_CATALOG,
  mergeCommunicationTemplates,
  parseCommunicationTemplateInput,
} from "../shared/communication-templates.ts";

test("provides exactly the six approved communication models", () => {
  assert.deepEqual(
    COMMUNICATION_TEMPLATE_CATALOG.map((item) => item.templateKey),
    ["hebdo", "urgent", "rentree", "document", "evenement", "rappel"]
  );
});

test("validates bounded templates and rejects secrets or unknown fields", () => {
  const sample = COMMUNICATION_TEMPLATE_CATALOG[0];
  assert.deepEqual(parseCommunicationTemplateInput(sample), sample);
  assert.throws(() => parseCommunicationTemplateInput({ ...sample, recipients: [] }), /unknown_field/);
  assert.throws(() => parseCommunicationTemplateInput({ ...sample, bodyMarkdown: "mot de passe: Azerty123!" }), /secret_forbidden/);
});

test("merges institution overrides without mutating the safe catalog", () => {
  const fallback = COMMUNICATION_TEMPLATE_CATALOG[0];
  const merged = mergeCommunicationTemplates([{ ...fallback, label: "Hebdo personnalisé", id: "fake-id", version: 2, updatedAt: "2026-08-30T00:00:00Z" }]);
  assert.equal(merged[0].label, "Hebdo personnalisé");
  assert.equal(merged[0].customized, true);
  assert.equal(merged[1].customized, false);
  assert.equal(COMMUNICATION_TEMPLATE_CATALOG[0].label, "Hebdo");
});

test("keeps template persistence scoped, directed and audited", () => {
  const route = readFileSync(new URL("../api/communications/admin/templates.ts", import.meta.url), "utf8");
  const access = readFileSync(new URL("../api/_shared/communications.ts", import.meta.url), "utf8");
  assert.match(route, /requireCommunicationEditor\(req\)/);
  assert.match(route, /requireCommunicationTemplateManager\(req\)/);
  assert.match(access, /COMMUNICATION_TEMPLATE_MANAGER_ROLES/);
  assert.match(route, /eq\(communicationTemplates\.institutionId, context\.institutionId\)/);
  assert.match(route, /db\.transaction/);
  assert.match(route, /onConflictDoUpdate/);
  assert.match(route, /communicationTemplateEvents/);
  assert.doesNotMatch(route, /communicationDeliveries|communicationJobs|communicationAudiences/);
});

test("creates private RLS-forced templates with append-only history", () => {
  const migration = readFileSync(new URL("../supabase/migrations/20260830070000_create_communication_templates.sql", import.meta.url), "utf8");
  for (const table of ["communication_templates", "communication_template_events"]) {
    assert.match(migration, new RegExp(`alter table public\\.${table} enable row level security`, "i"));
    assert.match(migration, new RegExp(`alter table public\\.${table} force row level security`, "i"));
    assert.match(migration, new RegExp(`revoke all on table public\\.${table} from public, anon, authenticated`, "i"));
  }
  assert.match(migration, /communication_template_events_append_only_trigger/i);
  assert.match(migration, /version must increment exactly once/i);
  assert.doesNotMatch(migration, /email|recipient|contact_ref/iu);
});
