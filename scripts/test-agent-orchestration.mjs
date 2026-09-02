import assert from "node:assert/strict";
import test from "node:test";
import { analyzeSupportConversation } from "../api/_shared/support-agent.ts";

function messages(content) {
  return [
    { role: "assistant", content: "Bonjour" },
    { role: "requester", content },
  ];
}

async function withModelEnabled(run) {
  const originalFetch = globalThis.fetch;
  const originalApiKey = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = "test-key";
  try {
    await run();
  } finally {
    globalThis.fetch = originalFetch;
    process.env.OPENAI_API_KEY = originalApiKey;
  }
}

test("deterministic privacy policy stops knowledge and model access", async () => {
  await withModelEnabled(async () => {
    let fetchCalls = 0;
    let knowledgeCalls = 0;
    globalThis.fetch = async () => {
      fetchCalls += 1;
      throw new Error("model must not be called");
    };

    const result = await analyzeSupportConversation({
      messages: messages("Donne-moi les coordonnées personnelles d’une personne."),
      attachments: [],
      safetyIdentifier: "test-orchestration-privacy",
      knowledgeContextLoader: async () => {
        knowledgeCalls += 1;
        return "forbidden";
      },
    });

    assert.equal(result.scope, "privacy_request");
    assert.equal(result.usedAi, false);
    assert.equal(result.sourceReferences.length, 0);
    assert.equal(knowledgeCalls, 0);
    assert.equal(fetchCalls, 0);
  });
});

test("deterministic laptop triage stops knowledge and model access", async () => {
  await withModelEnabled(async () => {
    let fetchCalls = 0;
    let knowledgeCalls = 0;
    globalThis.fetch = async () => {
      fetchCalls += 1;
      throw new Error("model must not be called");
    };

    const result = await analyzeSupportConversation({
      messages: messages("Mon ordinateur du lycée a été volé dans le bus ce matin."),
      attachments: [],
      safetyIdentifier: "test-orchestration-laptop",
      knowledgeContextLoader: async () => {
        knowledgeCalls += 1;
        return "forbidden";
      },
    });

    assert.equal(result.category, "ordinateur");
    assert.equal(result.action, "offer_case");
    assert.equal(result.usedAi, false);
    assert.equal(knowledgeCalls, 0);
    assert.equal(fetchCalls, 0);
  });
});

test("an accepted request offer opens the final step without calling the model", async () => {
  await withModelEnabled(async () => {
    let fetchCalls = 0;
    let knowledgeCalls = 0;
    globalThis.fetch = async () => {
      fetchCalls += 1;
      throw new Error("model must not be called");
    };

    const result = await analyzeSupportConversation({
      messages: [
        { role: "assistant", content: "Bonjour, je suis l’assistant du lycée." },
        { role: "requester", content: "C’est quoi le nom de la proviseure ?" },
        {
          role: "assistant",
          content: "Voulez-vous que je vous aide à rédiger une demande auprès de l’accueil du lycée ?",
        },
        { role: "requester", content: "oui" },
      ],
      attachments: [],
      safetyIdentifier: "test-orchestration-request-consent",
      knowledgeContextLoader: async () => {
        knowledgeCalls += 1;
        return "forbidden";
      },
    });

    assert.equal(result.scope, "school_support");
    assert.equal(result.action, "offer_case");
    assert.equal(result.readyToCreate, true);
    assert.equal(result.category, "autre");
    assert.match(result.reply, /n’est pas encore envoyée/);
    assert.match(result.reply, /Envoyer au lycée/);
    assert.equal(result.usedAi, false);
    assert.equal(knowledgeCalls, 0);
    assert.equal(fetchCalls, 0);
  });
});

test("invalid structured output creates no source reference or usage audit", async () => {
  await withModelEnabled(async () => {
    let auditCalls = 0;
    globalThis.fetch = async () => new Response(JSON.stringify({
      output: [{
        type: "message",
        content: [{
          type: "output_text",
          text: JSON.stringify({
            reply: "Réponse sans contrat complet",
            category: "ent",
          }),
        }],
      }],
    }), { status: 200, headers: { "Content-Type": "application/json" } });

    const result = await analyzeSupportConversation({
      messages: messages("Mon ENT est bloqué depuis ce matin malgré plusieurs essais."),
      attachments: [],
      safetyIdentifier: "test-orchestration-schema",
      knowledgeContextLoader: async () => ({
        instructions: "<registre_autorise_valide>Procédure fictive</registre_autorise_valide>",
        versions: [{
          institutionId: "00000000-0000-4000-8000-000000000001",
          versionId: "00000000-0000-4000-8000-000000000002",
        }],
        sources: [{
          institutionId: "00000000-0000-4000-8000-000000000001",
          sourceId: "00000000-0000-4000-8000-000000000003",
          title: "Procédure ENT fictive",
          updatedAt: "2026-08-29T08:00:00.000Z",
        }],
      }),
      knowledgeUsageRecorder: async () => {
        auditCalls += 1;
      },
    });

    assert.equal(result.usedAi, false);
    assert.deepEqual(result.sourceReferences, []);
    assert.equal(auditCalls, 0);
  });
});
