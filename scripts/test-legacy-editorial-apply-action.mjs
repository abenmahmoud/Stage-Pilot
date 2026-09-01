import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  LEGACY_EDITORIAL_CORRECTION_ACTION,
  LEGACY_EDITORIAL_CORRECTION_CONFIRMATION,
  parseLegacyEditorialCorrectionCommand,
} from "../shared/legacy-editorial-action.ts";
import {
  parseSiteContentAdminMutationPayload,
  projectSiteContentAdminMutationPayload,
} from "../shared/site-content-admin-payload.ts";
import {
  rolesForSiteContentAction,
  siteContentActionAccess,
} from "../shared/site-content-policy.ts";

const ITEM_ID = "11111111-1111-4111-8111-111111111111";

test("accepts only the exact confirmed correction command", () => {
  const valid = {
    action: LEGACY_EDITORIAL_CORRECTION_ACTION,
    expectedVersion: 7,
    confirmation: LEGACY_EDITORIAL_CORRECTION_CONFIRMATION,
  };
  assert.deepEqual(parseLegacyEditorialCorrectionCommand(valid), valid);
  for (const invalid of [
    null,
    { ...valid, extra: true },
    { ...valid, action: "verify_source" },
    { ...valid, expectedVersion: 0 },
    { ...valid, expectedVersion: 1.5 },
    { ...valid, expectedVersion: "7" },
    { ...valid, confirmation: "OUI" },
  ]) assert.throws(() => parseLegacyEditorialCorrectionCommand(invalid));
});

test("reserves correction to publishers and keeps the receipt in review", () => {
  assert.equal(siteContentActionAccess(LEGACY_EDITORIAL_CORRECTION_ACTION), "publisher");
  assert.deepEqual(rolesForSiteContentAction(LEGACY_EDITORIAL_CORRECTION_ACTION), ["superadmin", "proviseur"]);
  const receipt = projectSiteContentAdminMutationPayload({
    id: ITEM_ID,
    status: "brouillon",
    version: 8,
    needsReview: true,
  }, LEGACY_EDITORIAL_CORRECTION_ACTION, ITEM_ID);
  assert.deepEqual(
    parseSiteContentAdminMutationPayload(receipt, {
      action: LEGACY_EDITORIAL_CORRECTION_ACTION,
      itemId: ITEM_ID,
    }),
    receipt,
  );
  for (const invalid of [
    { ...receipt, status: "publie" },
    { ...receipt, status: "a_valider" },
    { ...receipt, needsReview: false },
    { ...receipt, correctionCount: 2 },
  ]) assert.equal(parseSiteContentAdminMutationPayload(invalid, {
    action: LEGACY_EDITORIAL_CORRECTION_ACTION,
    itemId: ITEM_ID,
  }), null);
});

test("the route is MFA, source, version and transaction guarded", async () => {
  const route = await readFile(new URL("../api/content/admin/[id]/action.ts", import.meta.url), "utf8");
  const branch = route.indexOf('if (action === "apply_editorial_corrections")', route.indexOf("const [current]"));
  const transaction = route.indexOf("return db.transaction", branch);
  const update = route.indexOf(".update(siteContentItems)", transaction);
  const audit = route.indexOf('action: "apply_editorial_corrections"', update);
  const disabledGuard = route.indexOf("if (!legacyEditorialCorrectionsEnabled)");
  const mfaGuard = route.indexOf("await requireAal2(req)");
  assert.ok(disabledGuard >= 0 && mfaGuard > disabledGuard && mfaGuard < route.indexOf("const [current]"));
  assert.ok(branch >= 0 && transaction > branch && update > transaction && audit > update);
  assert.match(route, /current\.sourceSystem !== "wordpress"/);
  assert.match(route, /!current\.importKey/);
  assert.match(route, /current\.status !== "brouillon"/);
  assert.match(route, /!current\.needsReview/);
  assert.match(route, /current\.version !== command\.expectedVersion/);
  assert.match(route, /eq\(siteContentItems\.version, command\.expectedVersion\)/);
  assert.match(route, /eq\(siteContentItems\.status, "brouillon"\)/);
  assert.match(route, /eq\(siteContentItems\.needsReview, true\)/);
  assert.match(route, /eq\(siteContentItems\.sourceSystem, "wordpress"\)/);
  assert.match(route, /if \(!item\)[\s\S]*?HttpError\(409/);
  assert.match(route, /snapshot: contentSnapshot\(correctedInput, "brouillon", nextVersion\)/);
  assert.match(route, /needsReview: true/);
  assert.match(route, /corrections: editorial\.corrections/);
  const auditBlock = route.slice(audit, route.indexOf("return projectSiteContentAdminMutationPayload", audit));
  assert.doesNotMatch(auditBlock, /editorial\.draft|bodyMarkdown|summary: current|title: current/);
});

test("the editor sends the confirmed current version and keeps human verification separate", async () => {
  const page = await readFile(new URL("../src/pages/admin/ContentManagerPage.tsx", import.meta.url), "utf8");
  assert.match(page, /expectedVersion = items\.find/);
  assert.match(page, /confirmation: "CORRIGER"/);
  assert.match(page, /Corriger les erreurs certaines/);
  assert.match(page, /LEGACY_EDITORIAL_CORRECTIONS_UI_ENABLED && draft\.needsReview/);
  assert.match(page, /act\("apply_editorial_corrections"\)/);
  assert.match(page, /act\("verify_source"\)/);
  assert.match(page, /Le brouillon reste à vérifier avant publication/);
});

test("the database audit constraint recognizes the bounded action", async () => {
  const migration = await readFile(new URL(
    "../supabase/migrations/20260901123000_add_legacy_editorial_correction_action.sql",
    import.meta.url,
  ), "utf8");
  assert.match(migration, /drop constraint if exists site_content_audit_action_check/);
  assert.match(migration, /'apply_editorial_corrections'/);
  assert.match(migration, /^begin;[\s\S]*commit;\s*$/);
});
