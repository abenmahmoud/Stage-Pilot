import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  communicationDraftContentHash,
  communicationDraftSourceFingerprint,
  parseCommunicationDraftInput,
} from "../shared/communication-draft.ts";

const valid = {
  sourceType: "direct_text",
  title: "Information fictive",
  summary: "Résumé fictif",
  bodyMarkdown: "Contenu strictement fictif.",
  category: "information",
};

test("parses a bounded direct draft and normalizes line endings", () => {
  assert.deepEqual(parseCommunicationDraftInput({ ...valid, bodyMarkdown: "Ligne 1\r\nLigne 2" }), {
    ...valid,
    bodyMarkdown: "Ligne 1\nLigne 2",
  });
});

test("computes separate stable server fingerprints", () => {
  const input = parseCommunicationDraftInput(valid);
  assert.match(communicationDraftSourceFingerprint(input), /^[a-f0-9]{64}$/);
  assert.match(communicationDraftContentHash(input), /^[a-f0-9]{64}$/);
  assert.notEqual(communicationDraftSourceFingerprint(input), communicationDraftContentHash(input));
  assert.equal(communicationDraftSourceFingerprint(input), communicationDraftSourceFingerprint({ ...input }));
});

test("rejects secrets, unknown fields and unsupported source types", () => {
  assert.throws(() => parseCommunicationDraftInput({ ...valid, bodyMarkdown: "mot de passe: Azerty123!" }), /secret_forbidden/);
  assert.throws(() => parseCommunicationDraftInput({ ...valid, recipients: ["x@example.test"] }), /unknown_field/);
  assert.throws(() => parseCommunicationDraftInput({ ...valid, sourceType: "forwarded_email" }), /source_type_invalid/);
});

test("keeps the API private, scoped, transactional and idempotent", () => {
  const route = readFileSync(new URL("../api/communications/admin/index.ts", import.meta.url), "utf8");
  const access = readFileSync(new URL("../api/_shared/communications.ts", import.meta.url), "utf8");
  assert.match(route, /requireCommunicationEditor\(req\)/);
  assert.match(access, /requireSupportAgent\(req\)/);
  assert.match(access, /readCommunicationFeatureFlags\(\)\.moduleEnabled/);
  assert.match(access, /communicationSettings\.moduleEnabled/);
  assert.match(route, /eq\(communications\.institutionId, context\.institutionId\)/);
  assert.match(route, /const result = await db\.transaction/);
  assert.match(route, /onConflictDoNothing/);
  assert.match(route, /communicationVersions/);
  assert.match(route, /communicationEvents/);
  assert.doesNotMatch(route, /req\.body\.sourceFingerprint|input\.sourceFingerprint/);
  assert.match(route, /visibility: "internal"/);
});
