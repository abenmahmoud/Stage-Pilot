import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { analyzeSupportConversation } from "../api/_shared/support-agent.ts";
import { requestedOwnCoursesDayOffset, scheduleAssistantDayAnswer } from "../shared/schedule-assistant.ts";

process.env.OPENAI_API_KEY = "";

test("a short day answer continues the personal timetable request and reads the correct Paris day", async () => {
  const initial = messages("Je voudrais mon emploi du temps.");
  const first = await analyzeSupportConversation({ messages: initial, attachments: [], identityVerified: true, safetyIdentifier: "schedule-followup" });
  for (const day of ["Demain", "Pour demain svp", "Aujourd’hui", "Et demain ?"]) {
    const dialogue = [...initial, {role:"assistant", content:first.reply}, {role:"requester",content:day}];
    let calls = 0;
    const answer = await analyzeSupportConversation({
      messages: dialogue, attachments: [], identityVerified: true,
      safetyIdentifier: "schedule-followup", now: new Date("2026-09-09T21:00:00Z"),
      scheduleDayReader: async ({dayStart}) => {
        calls++;
        assert.equal(dayStart.toISOString(), day.includes("Aujourd") ? "2026-09-08T22:00:00.000Z" : "2026-09-09T22:00:00.000Z");
        return {ok:false, reason:"source_unavailable"};
      },
    });
    assert.equal(calls, 1);
    assert.equal(answer.usedAi, false);
    assert.equal(answer.readyToCreate, true);
    assert.match(answer.reply, /Aucun emploi du temps validé/i);
  }
});

test("short day answers neither open unrelated schedules nor bypass identity verification", async () => {
  for (const prior of ["Je veux l’emploi du temps de mon enfant", "Quels sont les horaires de la cantine ?", "Je voudrais un certificat"]) {
    assert.equal(requestedOwnCoursesDayOffset([...messages(prior), {role:"requester",content:"demain"}]), null);
  }
  assert.equal(requestedOwnCoursesDayOffset(messages("demain")), null);
  assert.equal(requestedOwnCoursesDayOffset([...messages("mon emploi du temps"), {role:"requester",content:"les horaires de la cantine"}, {role:"requester",content:"demain"}]), null);
  assert.equal(requestedOwnCoursesDayOffset([...messages("mon emploi du temps"), {role:"requester",content:"demain pour mon fils"}]), null);
  const result = await analyzeSupportConversation({
    messages:[...messages("mon emploi du temps"),{role:"requester",content:"demain"}],
    attachments:[], identityVerified:false, safetyIdentifier:"schedule-followup-denied",
    scheduleDayReader:async()=>({ok:false,reason:"identity_i3_required"}),
  });
  assert.match(result.reply,/identité scolaire/i);
  assert.equal(result.readyToCreate,false);
  assert.deepEqual(result.sourceReferences,[]);
});

test("the timetable separates each course and preserves official cancellation and room uncertainty", () => {
  const result = scheduleAssistantDayAnswer({ok:true,courses:[
    {subjectCode:"MATH",subjectLabel:"Mathématiques",startsAt:"2026-09-10T06:00:00Z",endsAt:"2026-09-10T07:00:00Z",roomCode:"B204",state:"scheduled"},
    {subjectCode:"FR",subjectLabel:"Français",startsAt:"2026-09-10T07:00:00Z",endsAt:"2026-09-10T08:00:00Z",roomCode:null,state:"scheduled"},
    {subjectCode:"HG",subjectLabel:"Histoire",startsAt:"2026-09-10T08:00:00Z",endsAt:"2026-09-10T09:00:00Z",roomCode:null,state:"cancelled"},
  ],source:{versionId:"test",sourceType:"official_export",activatedAt:"2026-09-09T12:00:00Z",freshUntil:"2026-09-15T22:00:00Z"}},1);
  assert.match(result.reply,/\n• 08:00 – 09:00 · Mathématiques · Salle B204\n/);
  assert.match(result.reply,/Français · Salle à confirmer\n/);
  assert.match(result.reply,/Histoire · Cours annulé/);
  assert.match(result.reply,/Version du 9 septembre 2026/);
  assert.equal(result.readyToCreate,false);
});

function messages(content) {
  return [
    { role: "assistant", content: "Bonjour" },
    { role: "requester", content },
  ];
}

test("a generic personal timetable request starts identity verification instead of sending the user to a form", async () => {
  const result = await analyzeSupportConversation({
    messages: messages("Bonjour, je veux mon emploi du temps."),
    attachments: [],
    safetyIdentifier: "schedule-assistant-generic-identity",
    identityVerified: false,
  });
  assert.equal(result.usedAi, false);
  assert.equal(result.category, "affectation_classe");
  assert.equal(result.action, "continue");
  assert.equal(result.readyToCreate, false);
  assert.match(result.reply, /nom et votre prénom/i);
  assert.match(result.reply, /SMS ou par email parmi les contacts proposés/i);
});

test("after identity confirmation, a generic timetable request asks only for the desired day", async () => {
  const result = await analyzeSupportConversation({
    messages: messages("Je veux mon emploi du temps."),
    attachments: [],
    safetyIdentifier: "schedule-assistant-generic-day",
    identityVerified: true,
  });
  assert.equal(result.action, "continue");
  assert.deepEqual(result.missingInformation, ["Le jour souhaité"]);
  assert.match(result.reply, /aujourd’hui.*demain/i);
});

test("answers an own next-course request only from the private reader", async () => {
  let calls = 0;
  const metrics = [];
  const requestNow = new Date("2026-08-31T07:45:00.000Z");
  const result = await analyzeSupportConversation({
    messages: messages("Dans quelle salle est mon prochain cours ?"),
    attachments: [],
    safetyIdentifier: "schedule-assistant-success",
    now: requestNow,
    runtimeMetricsRecorder: async (metric) => metrics.push(metric),
    scheduleReader: async ({ requestedAt }) => {
      calls += 1;
      assert.equal(requestedAt, requestNow);
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
    scheduleReader: async () => ({ ok: false, reason: "identity_i3_required" }),
  });

  assert.equal(result.usedAi, false);
  assert.equal(result.readyToCreate, false);
  assert.equal(result.action, "continue");
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

test("tells a professor plainly that their own schedule is missing from the active version, not that they have no course", async () => {
  // LOT 1 a montré que `authorizedTeacherRefs` n'a aucune version active
  // tant que la seule source disponible est un PDF par classe : voir
  // `docs/operations/night-logs/PRO-LOT3.md`. Le message générique
  // "Aucun emploi du temps validé n'est disponible pour cette consultation"
  // ne dit pas explicitement que c'est SON emploi du temps de professeur qui
  // manque, ce qui peut se confondre avec "vous n'avez pas cours".
  const next = await analyzeSupportConversation({
    messages: messages("Où est mon prochain cours ?"),
    attachments: [],
    safetyIdentifier: "schedule-assistant-teacher-unavailable-next",
    scheduleReader: async () => ({ ok: false, reason: "teacher_schedule_unavailable" }),
  });
  assert.match(next.reply, /emploi du temps personnel de professeur/i);
  assert.match(next.reply, /version.*active/i);
  assert.doesNotMatch(next.reply, /vous n'avez pas de cours|aucun cours prévu/i);
  assert.equal(next.readyToCreate, true);

  const day = await analyzeSupportConversation({
    messages: messages("Quels sont mes cours aujourd'hui ?"),
    attachments: [],
    safetyIdentifier: "schedule-assistant-teacher-unavailable-day",
    scheduleDayReader: async () => ({ ok: false, reason: "teacher_schedule_unavailable" }),
  });
  assert.match(day.reply, /emploi du temps personnel de professeur/i);
  assert.match(day.reply, /version.*active/i);
});

test("answers an own today-courses request with every authorized course from the private reader", async () => {
  let calls = 0;
  const metrics = [];
  const requestNow = new Date("2026-08-31T07:45:00.000Z");
  const result = await analyzeSupportConversation({
    messages: messages("Quels sont mes cours aujourd'hui ?"),
    attachments: [],
    safetyIdentifier: "schedule-assistant-day-success",
    now: requestNow,
    runtimeMetricsRecorder: async (metric) => metrics.push(metric),
    scheduleDayReader: async ({ requestedAt, dayStart, dayEnd }) => {
      calls += 1;
      assert.equal(requestedAt, requestNow);
      assert.ok(dayStart instanceof Date);
      assert.ok(dayEnd instanceof Date);
      assert.ok(dayStart < dayEnd);
      return {
        ok: true,
        courses: [
          {
            subjectCode: "MATH",
            subjectLabel: "Mathématiques",
            roomCode: "B204",
            startsAt: "2026-08-31T08:00:00.000Z",
            endsAt: "2026-08-31T09:00:00.000Z",
            state: "scheduled",
          },
          {
            subjectCode: "HIST",
            subjectLabel: "Histoire",
            roomCode: "B105",
            startsAt: "2026-08-31T10:00:00.000Z",
            endsAt: "2026-08-31T11:00:00.000Z",
            state: "scheduled",
          },
        ],
        source: {
          versionId: "00000000-0000-4000-8000-000000000001",
          sourceType: "official_export",
          activatedAt: "2026-08-30T06:00:00.000Z",
          freshUntil: "2026-09-06T21:59:59.000Z",
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
  assert.match(result.reply, /Histoire/);
  assert.match(result.reply, /B105/);
  assert.doesNotMatch(result.reply, /professeur|teacher/i);
  assert.equal(result.sourceReferences.length, 1);
  assert.equal(metrics.length, 1);
  assert.equal(metrics[0].sourceCount, 1);
  assert.equal(metrics[0].aiAttempted, false);
});

test("answers an own tomorrow timetable request with the next Paris school day", async () => {
  const requestNow = new Date("2026-09-08T20:30:00.000Z");
  let receivedBounds = null;
  const result = await analyzeSupportConversation({
    messages: messages("Donne-moi mon emploi du temps demain."),
    attachments: [],
    safetyIdentifier: "schedule-assistant-tomorrow-success",
    now: requestNow,
    scheduleDayReader: async ({ dayStart, dayEnd }) => {
      receivedBounds = { dayStart, dayEnd };
      return {
        ok: true,
        courses: [{
          subjectCode: "NSI",
          subjectLabel: "Numérique et sciences informatiques",
          roomCode: "C112",
          startsAt: "2026-09-09T06:00:00.000Z",
          endsAt: "2026-09-09T07:00:00.000Z",
          state: "scheduled",
        }],
        source: {
          versionId: "00000000-0000-4000-8000-000000000001",
          sourceType: "official_export",
          activatedAt: "2026-09-08T18:00:00.000Z",
          freshUntil: "2026-09-15T21:59:59.000Z",
        },
      };
    },
  });

  assert.equal(receivedBounds.dayStart.toISOString(), "2026-09-08T22:00:00.000Z");
  assert.equal(receivedBounds.dayEnd.toISOString(), "2026-09-09T21:59:59.999Z");
  assert.equal(result.readyToCreate, false);
  assert.match(result.reply, /demain/i);
  assert.match(result.reply, /Numérique et sciences informatiques/);
  assert.match(result.reply, /C112/);
});

test("answers with no course today rather than failing when the day is empty", async () => {
  const result = await analyzeSupportConversation({
    messages: messages("Mon emploi du temps aujourd'hui ?"),
    attachments: [],
    safetyIdentifier: "schedule-assistant-day-empty",
    scheduleDayReader: async () => ({
      ok: true,
      courses: [],
      source: {
        versionId: "00000000-0000-4000-8000-000000000001",
        sourceType: "official_export",
        activatedAt: "2026-08-30T06:00:00.000Z",
        freshUntil: "2026-09-06T21:59:59.000Z",
      },
    }),
  });
  assert.match(result.reply, /aucun cours prévu aujourd'hui/i);
  assert.equal(result.readyToCreate, false);
});

test("requires a confirmed school identity for a day request without calling the model", async () => {
  const result = await analyzeSupportConversation({
    messages: messages("Quel est mon programme du jour ?"),
    attachments: [],
    safetyIdentifier: "schedule-assistant-day-identity",
    scheduleDayReader: async () => ({ ok: false, reason: "identity_i3_required" }),
  });

  assert.equal(result.usedAi, false);
  assert.equal(result.readyToCreate, false);
  assert.equal(result.action, "continue");
  assert.match(result.reply, /identité scolaire/i);
  assert.deepEqual(result.sourceReferences, []);
});

test("never turns a third-party day phrase into a schedule lookup", async () => {
  let calls = 0;
  const result = await analyzeSupportConversation({
    messages: messages("Quels sont les cours de mon enfant aujourd'hui ?"),
    attachments: [],
    safetyIdentifier: "schedule-assistant-day-third-party",
    scheduleDayReader: async () => {
      calls += 1;
      throw new Error("must not be called");
    },
  });

  assert.equal(calls, 0);
  assert.equal(result.usedAi, false);
});

test("the public assistant route injects only the verified-identity readers", async () => {
  const route = await readFile(new URL("../api/support/assistant.ts", import.meta.url), "utf8");
  assert.match(route, /readNextCourseForVerifiedIdentity/);
  assert.match(route, /readCoursesForDayForVerifiedIdentity/);
  assert.match(route, /error\.status === 401 \|\| error\.status === 403/);
  assert.doesNotMatch(route, /targetPersonRef\s*:/);
});
