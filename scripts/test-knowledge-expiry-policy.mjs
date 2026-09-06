import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { buildKnowledgeExpiryPlan } from "../shared/knowledge-expiry-policy.ts";

const workerSource = readFileSync(
  new URL("../api/cron/knowledge-expiry.ts", import.meta.url),
  "utf8"
);
// LOT 6 : le balayage lui-même (péremption + désactivation des compétences)
// a été extrait dans ce module pour être rejoué par les routes de
// publication (voir scripts/test-knowledge-freshness-schedule.mjs) — le
// cron ne fait plus que vérifier le secret puis déléguer selon l'heure.
const sweepSource = readFileSync(
  new URL("../api/_shared/knowledge-freshness-sweep.ts", import.meta.url),
  "utf8"
);

const now = "2026-08-28T00:00:00.000Z";
const skills = [
  {
    skillId: "skill-sources",
    institutionId: "institution-test",
    activeVersionId: "version-sources",
    reviewDueAt: "2026-12-31T23:59:59.000Z",
  },
  {
    skillId: "skill-review",
    institutionId: "institution-test",
    activeVersionId: "version-review",
    reviewDueAt: "2026-08-27T23:59:59.000Z",
  },
];

test("disables a skill when a required source expires", () => {
  const plan = buildKnowledgeExpiryPlan({
    skills,
    links: [{ skillVersionId: "version-sources", sourceId: "source-expired", required: true }],
    expiredSourceIds: ["source-expired"],
    now,
  });
  assert.deepEqual(plan[0], {
    skillId: "skill-sources",
    institutionId: "institution-test",
    reasons: ["source_expired"],
    expiredSourceIds: ["source-expired"],
  });
});

test("keeps a skill active when only an optional source expires", () => {
  const plan = buildKnowledgeExpiryPlan({
    skills: [skills[0]],
    links: [{ skillVersionId: "version-sources", sourceId: "source-expired", required: false }],
    expiredSourceIds: ["source-expired"],
    now,
  });
  assert.deepEqual(plan, []);
});

test("disables an overdue version without inventing a new review date", () => {
  const plan = buildKnowledgeExpiryPlan({
    skills: [skills[1]],
    links: [],
    expiredSourceIds: [],
    now,
  });
  assert.deepEqual(plan[0].reasons, ["review_overdue"]);
  assert.deepEqual(plan[0].expiredSourceIds, []);
});

test("merges multiple expiry reasons into one skill action", () => {
  const plan = buildKnowledgeExpiryPlan({
    skills: [{ ...skills[1], activeVersionId: "version-review" }],
    links: [
      { skillVersionId: "version-review", sourceId: "source-b", required: true },
      { skillVersionId: "version-review", sourceId: "source-a", required: true },
    ],
    expiredSourceIds: ["source-a", "source-b"],
    now,
  });
  assert.deepEqual(plan[0].reasons, ["source_expired", "review_overdue"]);
  assert.deepEqual(plan[0].expiredSourceIds, ["source-a", "source-b"]);
});

test("rejects an invalid maintenance timestamp safely", () => {
  assert.deepEqual(buildKnowledgeExpiryPlan({ skills, links: [], expiredSourceIds: [], now: "invalid" }), []);
});

test("authenticates the maintenance request before opening a transaction", () => {
  const authentication = workerSource.indexOf("secretMatches(process.env.CRON_SECRET, provided)");
  const transaction = workerSource.indexOf("db.transaction");
  assert.ok(authentication >= 0);
  assert.ok(transaction > authentication);
});

test("records automatic source and skill actions without a human actor", () => {
  assert.match(sweepSource, /action: "expire_automatic"[\s\S]*?actorId: null/);
  assert.match(sweepSource, /action: "disable_automatic"[\s\S]*?actorId: null/);
});
