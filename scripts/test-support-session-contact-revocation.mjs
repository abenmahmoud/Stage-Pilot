import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { drizzle } from "drizzle-orm/postgres-js";
import { and, eq, gt, isNull } from "drizzle-orm";
import {
  supportContacts,
  supportDeviceSessions,
  supportRequests,
  supportSessionRequests,
} from "../db/schema.ts";
import {
  supportSessionContactPredicate,
  supportSessionContactStateAllowsAccess,
} from "../api/_shared/support-session-contact.ts";

const root = new URL("../", import.meta.url);

test("allows an unbound creation session and only an exact active support email binding", () => {
  const active = {
    id: "contact-a", requestId: "request-a", channel: "email",
    usageScope: "support", disabledAt: null,
  };
  assert.equal(supportSessionContactStateAllowsAccess({ accessContactId: null, requestId: "request-a", contact: null }), true);
  assert.equal(supportSessionContactStateAllowsAccess({ accessContactId: "contact-a", requestId: "request-a", contact: active }), true);
  for (const contact of [
    null,
    { ...active, id: "contact-b" },
    { ...active, requestId: "request-b" },
    { ...active, channel: "phone" },
    { ...active, usageScope: "communications" },
    { ...active, disabledAt: new Date() },
  ]) {
    assert.equal(supportSessionContactStateAllowsAccess({ accessContactId: "contact-a", requestId: "request-a", contact }), false);
  }
});

test("the real Drizzle predicate binds the session contact to the exact request and active scope", () => {
  const query = drizzle.mock()
    .select({ id: supportDeviceSessions.id })
    .from(supportDeviceSessions)
    .innerJoin(supportSessionRequests, eq(supportSessionRequests.sessionId, supportDeviceSessions.id))
    .innerJoin(supportRequests, eq(supportRequests.id, supportSessionRequests.requestId))
    .leftJoin(supportContacts, eq(supportContacts.id, supportDeviceSessions.accessContactId))
    .where(and(
      gt(supportDeviceSessions.expiresAt, new Date("2026-09-02T00:00:00Z")),
      isNull(supportDeviceSessions.revokedAt),
      supportSessionContactPredicate()
    ));
  const rendered = query.toSQL();
  assert.match(rendered.sql, /left join "support_contacts" on "support_contacts"\."id" = "support_device_sessions"\."access_contact_id"/);
  assert.match(rendered.sql, /"access_contact_id" is null or \("support_contacts"\."id" = "support_device_sessions"\."access_contact_id"/);
  assert.match(rendered.sql, /"support_contacts"\."request_id" = "support_requests"\."id"/);
  assert.deepEqual(rendered.params.slice(-2), ["email", "support"]);
});

test("every public session consumer applies the shared contact predicate", async () => {
  for (const path of [
    "api/_shared/support.ts",
    "api/_shared/support-rate-limits.ts",
    "api/support/requests/index.ts",
  ]) {
    const source = await readFile(new URL(`../${path}`, import.meta.url), "utf8");
    assert.match(source, /leftJoin\(supportContacts, eq\(supportContacts\.id, supportDeviceSessions\.accessContactId\)\)/);
    assert.match(source, /supportSessionContactPredicate\(\)/);
  }
});

test("magic-link sessions persist their contact provenance", async () => {
  const source = await readFile(new URL("../api/_shared/support-access-session.ts", import.meta.url), "utf8");
  assert.match(source, /accessContactId: input\.contactId/);
  assert.ok(source.indexOf("accessContactId: input.contactId") < source.indexOf(".insert(supportSessionRequests)"));
});

test("the ordinary first-request session stays unbound to an unverified address", async () => {
  const source = await readFile(new URL("../api/support/requests/index.ts", import.meta.url), "utf8");
  const start = source.indexOf(".insert(supportDeviceSessions)");
  const end = source.indexOf(".returning({ id: supportDeviceSessions.id })", start);
  assert.ok(start >= 0 && end > start);
  const creation = source.slice(start, end);
  assert.match(creation, /label: "Navigateur public"/);
  assert.doesNotMatch(creation, /accessContactId|contactId/);
});

test("migration closes legacy sessions and revokes only contact-bound access", async () => {
  const source = await readFile(new URL("../supabase/migrations/20260901223342_bind_support_sessions_to_contacts.sql", import.meta.url), "utf8");
  assert.match(source, /add column access_contact_id uuid/);
  assert.match(source, /set revoked_at = clock_timestamp\(\)\s+where revoked_at is null/);
  assert.match(source, /foreign key \(access_contact_id\)[\s\S]*on delete set null[\s\S]*not valid/);
  assert.match(source, /security invoker\s+set search_path = ''/);
  assert.match(source, /where access_contact_id = affected_contact_id\s+and revoked_at is null/);
  assert.match(source, /where contact_id = affected_contact_id\s+and used_at is null/);
  assert.match(source, /after update of disabled_at/);
  assert.match(source, /before delete on public\.support_contacts/);
  assert.match(source, /revoke all on function public\.support_revoke_contact_access\(\) from public, anon, authenticated/);
});

test("the concurrent preview recipe is pinned, fictional and cleans every fixture", async () => {
  const source = await readFile(new URL("./test-preview-support-session-contact-concurrency.mjs", import.meta.url), "utf8");
  const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
  assert.match(source, /--preview-only/);
  assert.match(source, /CONFIRM_PREVIEW_SUPPORT_SESSION_CONTACT/);
  assert.match(source, /communicationInboundPreviewDatabaseUrl\(process\.env\.DATABASE_URL\)/);
  assert.match(source, /ssl: \{ rejectUnauthorized: true \}/);
  assert.match(source, /@example\.invalid/);
  assert.match(source, /delete from public\.support_device_sessions where id=/);
  assert.match(source, /delete from public\.support_requests where id=/);
  assert.match(source, /assert\.equal\(remaining\.count, 0/);
  assert.doesNotMatch(source, /sfqhxiamhgsbbogluqtq|@ac-creteil\.fr|@gmail\.com|admin93/);
  assert.match(packageJson.scripts["test:preview-support-session-contact-concurrency"], /--preview-only/);
  assert.doesNotMatch(packageJson.scripts["test:preview-security-gate"], /test:preview-support-session-contact-concurrency/);
});
