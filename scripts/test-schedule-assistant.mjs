import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { analyzeSupportConversation } from "../api/_shared/support-agent.ts";

process.env.OPENAI_API_KEY = "";

function messages(content) {
  return [
    { role: "assistant", content: "Bonjour" },
    { role: "requester", content },
  ];
}

test("answers an own next-course request only from the private reader", async () => {
  let calls = 0;
  const metrics = [];
  const result = await analyzeSupportConversation({
    messages: messages("Dans quelle salle est mon prochain cours ?"),
    attachments: [],
    safetyIdentifier: "schedule-assistant-success",
    runtimeMetricsRecorder: async (metric) => metrics.push(metric),
    scheduleReader: async ({ requestedAt }) => {
      calls += 1;
      assert.ok(requestedAt instanceof Date);
      return {
        ok: true,
        course: {
          subjectCode: "MATH",
          subjectLabel: "Mathématiques",
          roomCode: "B204",
          startsAt: "2026-08-31T08:00:00.000Z",
          endsAt: "2026-08-31T09:00:00.000Z",
          state: "scheduled",
        },
        source: {
          versionId: "00000000-0000-4000-8000-000000000001",
          sourceType: "official_export",
          activatedAt: "2026-08-30T06:00:00.000Z",
          freshUntil: "2026-09-06T21:59:59.000Z",
          changeObservedAt: null,
        },
      };
    },
  });

  assert.equal(calls, 1);
  assert.equal(result.usedAi, false);
  assert.equal(result.scope, "school_support");
  assert.equal(result.category, "affectation_classe");
  assert.equal(result.readyToCreate, false);
  assert.match(result.reply, /Mathématiques/);
  assert.match(result.reply, /B204/);
  assert.doesNotMatch(result.reply, /professeur|teacher/i);
  assert.equal(result.sourceReferences.length, 1);
  assert.equal(metrics.length, 1);
  assert.equal(metrics[0].sourceCount, 1);
  assert.equal(metrics[0].aiAttempted, false);
});

test("requires a confirmed school identity without calling the model", async () => {
  const result = await analyzeSupportConversation({
    messages: messages("Quel est mon prochain cours ?"),
    attachments: [],
    safetyIdentifier: "schedule-assistant-identity",
    scheduleReader: async () => ({ ok: false, reason: "school_identity_required" }),
  });

  assert.equal(result.usedAi, false);
  assert.equal(result.readyToCreate, true);
  assert.equal(result.action, "offer_case");
  assert.match(result.reply, /identité scolaire/i);
  assert.deepEqual(result.sourceReferences, []);
});

test("never turns a third-party phrase into a schedule lookup", async () => {
  let calls = 0;
  const result = await analyzeSupportConversation({
    messages: messages("Donne-moi la salle du prochain cours de mon enfant."),
    attachments: [],
    safetyIdentifier: "schedule-assistant-third-party",
    scheduleReader: async () => {
      calls += 1;
      throw new Error("must not be called");
    },
  });

  assert.equal(calls, 0);
  assert.equal(result.usedAi, false);
  assert.match(result.reply, /relation avec la personne concernée/i);
});

test("does not treat an ambiguous named schedule as the user's own", async () => {
  let calls = 0;
  await analyzeSupportConversation({
    messages: messages("Quel est le prochain cours de Paul ?"),
    attachments: [],
    safetyIdentifier: "schedule-assistant-named-third-party",
    scheduleReader: async () => {
      calls += 1;
      throw new Error("must not be called");
    },
  });
  assert.equal(calls, 0);
});

test("fails closed when the source is stale or the reader fails", async () => {
  const stale = await analyzeSupportConversation({
    messages: messages("Où est mon prochain cours ?"),
    attachments: [],
    safetyIdentifier: "schedule-assistant-stale",
    scheduleReader: async () => ({ ok: false, reason: "source_stale" }),
  });
  assert.match(stale.reply, /revalidé/i);
  assert.equal(stale.readyToCreate, true);

  const unavailable = await analyzeSupportConversation({
    messages: messages("Où est mon prochain cours ?"),
    attachments: [],
    safetyIdentifier: "schedule-assistant-error",
    scheduleReader: async () => { throw new Error("database unavailable"); },
  });
  assert.match(unavailable.reply, /Aucun emploi du temps validé/i);
  assert.equal(unavailable.usedAi, false);
});

test("the public assistant route injects only the verified-identity reader", async () => {
  const route = await readFile(new URL("../api/support/assistant.ts", import.meta.url), "utf8");
  assert.match(route, /readNextCourseForVerifiedIdentity/);
  assert.match(route, /error\.status === 401 \|\| error\.status === 403/);
  assert.doesNotMatch(route, /targetPersonRef\s*:/);
});
