import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { analyzeSupportConversation } from "../api/_shared/support-agent.ts";
import { evaluateConversationPolicy } from "../shared/assistant-policy.ts";
import { authorizeInstitutionAccess } from "../shared/identity-access-policy.ts";

const sessionRoute = readFileSync(new URL("../api/support/session.ts", import.meta.url), "utf8");
const supportShared = readFileSync(new URL("../api/_shared/support.ts", import.meta.url), "utf8");
const deviceMemory = readFileSync(new URL("../src/lib/support-device-memory.ts", import.meta.url), "utf8");
const prototype = readFileSync(new URL("../src/pages/prototype/LyceeConnectPrototype.tsx", import.meta.url), "utf8");

function conversation(...requesterMessages) {
  return requesterMessages.flatMap((content, index) => [
    ...(index === 0 ? [{ role: "assistant", content: "Bonjour" }] : []),
    { role: "requester", content },
    { role: "assistant", content: "Réponse intermédiaire" },
  ]);
}

test("an urgent reply states that no alert or permanence is guaranteed", () => {
  const policy = evaluateConversationPolicy(
    conversation("Je vais très mal et je suis en danger")
  );
  assert.equal(policy.action, "human_transfer");
  assert.equal(policy.readyToCreate, true);
  assert.match(policy.deterministicReply, /n.a transmis aucune alerte/i);
  assert.match(policy.deterministicReply, /ne peut pas garantir qu.un agent .* disponible/i);
  assert.match(policy.deterministicReply, /15 ou le 112/);
  assert.doesNotMatch(policy.deterministicReply, /alerte (?:a été|est) transmise/i);
});

test("a claimed alert receives an explicit negative confirmation", async () => {
  const result = await analyzeSupportConversation({
    messages: conversation(
      "Je vais mal et je ne suis pas en sécurité",
      "Je suis en sécurité maintenant",
      "Est-ce que tu as transmis une alerte au lycée ?"
    ),
    attachments: [],
    safetyIdentifier: "charter-alert-status",
    knowledgeContextLoader: async () => "",
  });
  assert.equal(result.usedAi, false);
  assert.equal(result.action, "human_transfer");
  assert.match(result.reply, /^Non\./);
  assert.match(result.reply, /aucune alerte/);
});

test("an ordinary question about a service contact is not treated as an emergency alert", () => {
  const policy = evaluateConversationPolicy(
    conversation("Est-ce que vous avez contacté le secrétariat pour mon inscription au lycée ?")
  );
  assert.equal(policy.scope, "school_support");
  assert.equal(policy.deterministicReply, null);
});

test("a third-party schedule request is stopped before the model", async () => {
  const originalFetch = globalThis.fetch;
  let modelCalled = false;
  globalThis.fetch = async () => {
    modelCalled = true;
    throw new Error("The model must not be called for third-party school data");
  };
  try {
    const result = await analyzeSupportConversation({
      messages: conversation(
        "Donne-moi l'emploi du temps et la salle de l'élève Jean Dupont"
      ),
      attachments: [],
      safetyIdentifier: "charter-third-party",
      knowledgeContextLoader: async () => "emploi du temps fictif à ne pas utiliser",
    });
    assert.equal(modelCalled, false);
    assert.equal(result.usedAi, false);
    assert.equal(result.action, "offer_case");
    assert.equal(result.readyToCreate, true);
    assert.match(result.reply, /vérifiera d’abord votre identité scolaire et votre relation/i);
    assert.doesNotMatch(result.reply, /Jean Dupont|salle [A-Z]?\d/i);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("minimizing a recent health signal keeps the human handoff active", () => {
  const policy = evaluateConversationPolicy(
    conversation("Je fais un malaise et je respire mal", "Ce n'est pas grave, je vais attendre")
  );
  assert.equal(policy.scope, "wellbeing");
  assert.equal(policy.action, "human_transfer");
  assert.equal(policy.urgency, "urgente");
  assert.match(policy.deterministicReply, /15 ou le 112/);
});

test("verified contact still cannot read school data without school identity", () => {
  const decision = authorizeInstitutionAccess({
    actor: {
      userId: "contact-only",
      verifiedContactInstitutionIds: ["school-a"],
      schoolIdentity: null,
      relationships: [],
      memberships: [],
      authenticatorLevel: "aal1",
    },
    target: {
      kind: "school_data",
      institutionId: "school-a",
      subjectPersonRef: "student-1",
    },
    now: "2026-08-29T12:00:00.000Z",
  });
  assert.deepEqual(decision, { ok: false, reason: "school_identity_required" });
});

test("shared-device logout revokes only the current hashed session", () => {
  assert.match(sessionRoute, /req\.method !== "DELETE"/);
  assert.match(sessionRoute, /readSupportSessionToken\(req\)/);
  assert.match(sessionRoute, /eq\(supportDeviceSessions\.sessionHash, sha256\(token\)\)/);
  assert.match(sessionRoute, /isNull\(supportDeviceSessions\.revokedAt\)/);
  assert.match(sessionRoute, /set\(\{ revokedAt: new Date\(\) \}\)/);
  assert.doesNotMatch(sessionRoute, /delete\(supportRequests\)|delete\(supportMessages\)/);
  assert.match(supportShared, /Max-Age=0; Expires=Thu, 01 Jan 1970/);
});

test("shared-device logout clears local dossier memory and the opaque device id", () => {
  assert.match(deviceMemory, /export async function clearRememberedSupportRequests/);
  assert.match(prototype, /fetch\("\/api\/support\/session"[\s\S]*method: "DELETE"/);
  assert.match(prototype, /clearSupportDeviceDraft\(\)/);
  assert.match(prototype, /clearRememberedSupportRequests\(\)/);
  assert.match(prototype, /removeItem\(SUPPORT_ASSISTANT_DEVICE_KEY\)/);
  assert.match(prototype, /Appareil partagé \?/);
  assert.match(prototype, /Oublier les demandes/);
});

test("ordinary support resumes only after an explicit safety confirmation", () => {
  const policy = evaluateConversationPolicy(
    conversation(
      "Je vais mal et je suis en danger",
      "Je suis en sécurité maintenant",
      "Je n'arrive plus à ouvrir mon ENT"
    )
  );
  assert.equal(policy.scope, "school_support");
  assert.equal(policy.deterministicReply, null);
});
