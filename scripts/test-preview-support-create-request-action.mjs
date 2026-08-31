import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";

const EXPECTED_PROJECT_REF = "xijocumlwivhbmffrnlj";
const ROLLBACK_RECIPE = new Error("rollback_preview_create_request_action_recipe");

async function loadEnvFile(path) {
  let content;
  try {
    content = await readFile(path, "utf8");
  } catch (error) {
    if (error?.code === "ENOENT" && process.env.DATABASE_URL) return;
    throw error;
  }
  for (const line of content.split(/\r?\n/)) {
    const match = line.match(/^([A-Z][A-Z0-9_]*)=(.*)$/);
    if (!match || process.env[match[1]]) continue;
    const rawValue = match[2].trim();
    process.env[match[1]] =
      rawValue.length >= 2
      && ((rawValue.startsWith('"') && rawValue.endsWith('"'))
        || (rawValue.startsWith("'") && rawValue.endsWith("'")))
        ? rawValue.slice(1, -1)
        : rawValue;
  }
}

const cliRun = process.argv.includes("--preview-only");
const isolatedPreviewRuntime = process.env.VERCEL_ENV === "preview"
  && process.env.PREVIEW_ACTION_RECIPE_AUTHORIZED === "true";
if (!cliRun && !isolatedPreviewRuntime) {
  throw new Error("Use --preview-only to confirm the isolated preview recipe");
}
await loadEnvFile(process.env.PREVIEW_ENV_FILE ?? ".env.preview.runtime.local");

const databaseUrl = process.env.DATABASE_URL ?? "";
assert.match(databaseUrl, new RegExp(EXPECTED_PROJECT_REF), "Unexpected Supabase preview target");
assert.doesNotMatch(
  databaseUrl,
  new RegExp(process.env.PRODUCTION_SUPABASE_REF || "production-ref-must-not-match"),
  "Preview and production database targets must differ"
);
process.env.SUPPORT_AGENT_CREATE_REQUEST_ACTION_ENABLED = "true";

const [{ and, count, eq, like }, { db }, schema, actionModule, receiptModule, routingModule] =
  await Promise.all([
    import("drizzle-orm"),
    import("../db/index.js"),
    import("../db/schema.js"),
    import("../api/_shared/support-create-request-action.js"),
    import("../shared/support-assistant-routing-receipt.js"),
    import("../shared/support-routing.js"),
  ]);

const {
  agentActionAudit,
  agentActions,
  agentSkills,
  agentSkillVersions,
  institutionMemberships,
  institutions,
  knowledgeSources,
  skillSourceLinks,
  supportRequests,
} = schema;
const {
  completeSupportCreateRequestAction,
  startSupportCreateRequestAction,
} = actionModule;
const {
  createSupportAssistantRoutingReceipt,
  supportAgentCreateRequestActionEnabled,
  verifySupportAssistantRoutingReceipt,
} = receiptModule;
const { routeSupportRequest } = routingModule;
const { loadPublicKnowledgeContext } = await import("../api/_shared/public-knowledge-context.js");

const runId = randomUUID();
const marker = runId.replaceAll("-", "").slice(0, 10);
const ids = {
  source: randomUUID(),
  skill: randomUUID(),
  version: randomUUID(),
  request: randomUUID(),
};
let actionId = null;
const checksum = (value) => createHash("sha256").update(value).digest("hex");
const skillKey = `preview-create-request-${marker}`;
const sourceTitle = `[TEST] Création de demande ENT ${marker}`;
const requesterRefHash = checksum(`preview-device:${runId}`);
const requestIdempotencyHash = checksum(`preview-request:${runId}`);

const [context] = await db
  .select({ institutionId: institutions.id, ownerUserId: institutionMemberships.userId })
  .from(institutions)
  .innerJoin(
    institutionMemberships,
    eq(institutionMemberships.institutionId, institutions.id)
  )
  .where(and(
    eq(institutions.slug, "blaise-cendrars-sevran"),
    eq(institutionMemberships.status, "active"),
    eq(institutionMemberships.role, "admin")
  ))
  .limit(1);
assert.ok(context, "No active preview administrator is available for the fictional source owner");

async function fixtureCounts() {
  const [skills] = await db
    .select({ value: count() })
    .from(agentSkills)
    .where(and(
      eq(agentSkills.institutionId, context.institutionId),
      like(agentSkills.skillKey, "preview-create-request-%")
    ));
  const [sources] = await db
    .select({ value: count() })
    .from(knowledgeSources)
    .where(and(
      eq(knowledgeSources.institutionId, context.institutionId),
      like(knowledgeSources.title, "[TEST] Création de demande ENT %")
    ));
  const [actions] = await db
    .select({ value: count() })
    .from(agentActions)
    .where(eq(agentActions.id, actionId ?? randomUUID()));
  const [requests] = await db
    .select({ value: count() })
    .from(supportRequests)
    .where(eq(supportRequests.id, ids.request));
  return {
    skills: Number(skills.value),
    sources: Number(sources.value),
    actions: Number(actions.value),
    requests: Number(requests.value),
  };
}

async function seedSkill() {
  const now = new Date();
  await db.transaction(async (tx) => {
    await tx.insert(knowledgeSources).values({
      id: ids.source,
      institutionId: context.institutionId,
      title: sourceTitle,
      sourceType: "procedure",
      uri: `urn:lyceegest:preview:create-request:${runId}`,
      classification: "public",
      ownerUserId: context.ownerUserId,
      serviceCodes: [],
      validFrom: new Date(now.getTime() - 60_000),
      expiresAt: new Date(now.getTime() + 24 * 60 * 60_000),
      status: "published",
      checksum: checksum(`source:${runId}`),
    });
    await tx.insert(agentSkills).values({
      id: ids.skill,
      institutionId: context.institutionId,
      skillKey,
      name: `Création de demande ENT fictive ${marker}`,
      domain: "ENT assistance fictive",
      enabled: false,
    });
    await tx.insert(agentSkillVersions).values({
      id: ids.version,
      institutionId: context.institutionId,
      skillId: ids.skill,
      version: "1.0.0",
      status: "published",
      definition: {
        instructions: "Pour cette recette fictive ENT uniquement, préparer une demande au référent numérique sans demander ni communiquer de mot de passe.",
        allowedTools: ["support.create_request"],
      },
      contentHash: checksum(`version:${runId}`),
      dataClassification: "public",
      createdBy: context.ownerUserId,
      approvedBy: context.ownerUserId,
      publishedAt: now,
      reviewDueAt: new Date(now.getTime() + 24 * 60 * 60_000),
    });
    await tx.insert(skillSourceLinks).values({
      institutionId: context.institutionId,
      skillVersionId: ids.version,
      sourceId: ids.source,
      required: true,
    });
    await tx
      .update(agentSkills)
      .set({ enabled: true, activeVersionId: ids.version })
      .where(eq(agentSkills.id, ids.skill));
  });
}

async function cleanupSkill() {
  await db.transaction(async (tx) => {
    await tx
      .update(agentSkills)
      .set({ enabled: false, activeVersionId: null })
      .where(eq(agentSkills.id, ids.skill));
    await tx.delete(skillSourceLinks).where(eq(skillSourceLinks.skillVersionId, ids.version));
    await tx.delete(agentSkillVersions).where(eq(agentSkillVersions.id, ids.version));
    await tx.delete(agentSkills).where(eq(agentSkills.id, ids.skill));
    await tx.delete(knowledgeSources).where(eq(knowledgeSources.id, ids.source));
  });
}

const before = await fixtureCounts();
assert.deepEqual(before, { skills: 0, sources: 0, actions: 0, requests: 0 });
let recipeResult = null;
let rolledBack = false;

try {
  await seedSkill();
  assert.equal(supportAgentCreateRequestActionEnabled(), true);

  const loaded = await loadPublicKnowledgeContext({
    query: `Je suis un élève fictif et mon accès ENT est bloqué ${marker}.`,
  });
  const selected = loaded.versions.find((version) => version.versionId === ids.version);
  assert.ok(selected, "The published fictional skill was not selected");
  assert.deepEqual(selected.allowedTools, ["support.create_request"]);

  const signed = createSupportAssistantRoutingReceipt({
    institutionId: context.institutionId,
    category: "ent",
    service: "referent_numerique",
    usedAi: false,
    model: null,
    actionGrant: {
      toolKey: "support.create_request",
      skillVersionId: ids.version,
      requesterRefHash,
    },
    secret: `preview-recipe-secret-${runId}`,
  });
  assert.ok(signed, "The fictional action grant was not signed");
  const verified = verifySupportAssistantRoutingReceipt({
    receipt: signed.receipt,
    institutionId: context.institutionId,
    category: "ent",
    service: "referent_numerique",
    expectedRequesterRefHash: requesterRefHash,
    secret: `preview-recipe-secret-${runId}`,
  });
  assert.equal(verified?.actionGrant?.skillVersionId, ids.version);
  assert.equal(verifySupportAssistantRoutingReceipt({
    receipt: signed.receipt,
    institutionId: context.institutionId,
    category: "ent",
    service: "referent_numerique",
    expectedRequesterRefHash: checksum(`other-device:${runId}`),
    secret: `preview-recipe-secret-${runId}`,
  }), null);

  const routing = routeSupportRequest({
    category: "ent",
    subject: "Accès ENT fictif",
    description: "Demande entièrement fictive de recette pour un accès ENT bloqué.",
  });
  const supportInput = {
    requesterType: "eleve",
    requesterFirstName: "Recette",
    requesterLastName: `Fictive-${marker}`,
    beneficiaryType: "self",
    beneficiaryFirstName: "Recette",
    beneficiaryLastName: `Fictive-${marker}`,
    subjectContext: {},
    category: "ent",
    subcategory: null,
    subject: "Accès ENT fictif",
    description: "Demande entièrement fictive de recette pour un accès ENT bloqué.",
    preferredChannel: "email",
    fallbackAllowed: false,
    callbackRequested: false,
    email: `codex-create-request-${marker}@example.test`,
    phone: null,
    assistantRoutingReceipt: signed.receipt,
    routing,
    conversation: [
      { role: "assistant", content: "Bonjour, décrivez votre difficulté." },
      { role: "requester", content: "Mon accès ENT fictif est bloqué." },
    ],
  };

  try {
    await db.transaction(async (tx) => {
      const started = await startSupportCreateRequestAction({
        tx,
        institutionId: context.institutionId,
        grant: verified.actionGrant,
        supportInput,
        requesterRefHash,
        requestIdempotencyHash,
      });
      actionId = started.row.id;
      assert.equal(started.row.status, "running");
      assert.equal(started.needsCompletion, true);

      const [request] = await tx
        .insert(supportRequests)
        .values({
          id: ids.request,
          institutionId: context.institutionId,
          idempotencyKeyHash: requestIdempotencyHash,
          requesterType: supportInput.requesterType,
          requesterFirstName: supportInput.requesterFirstName,
          requesterLastName: supportInput.requesterLastName,
          beneficiaryType: supportInput.beneficiaryType,
          beneficiaryFirstName: supportInput.beneficiaryFirstName,
          beneficiaryLastName: supportInput.beneficiaryLastName,
          subjectContext: {},
          category: supportInput.category,
          subject: supportInput.subject,
          description: supportInput.description,
          preferredChannel: supportInput.preferredChannel,
          fallbackAllowed: false,
          assignedTeam: routing.service,
        })
        .returning({
          id: supportRequests.id,
          publicCode: supportRequests.publicCode,
          status: supportRequests.status,
        });
      const confirmation = await completeSupportCreateRequestAction({
        tx,
        action: started,
        request,
        duplicate: false,
      });
      assert.equal(confirmation.status, "succeeded");
      assert.equal(confirmation.requestPublicCode, request.publicCode);
      assert.equal(confirmation.confirmationRef, `agent-action:${actionId}`);

      const [persisted] = await tx
        .select({
          status: agentActions.status,
          inputRedacted: agentActions.inputRedacted,
          toolResult: agentActions.toolResult,
          supportRequestId: agentActions.supportRequestId,
          confirmedAt: agentActions.confirmedAt,
        })
        .from(agentActions)
        .where(eq(agentActions.id, actionId));
      assert.equal(persisted.status, "succeeded");
      assert.equal(persisted.supportRequestId, request.id);
      assert.ok(persisted.confirmedAt instanceof Date);
      assert.deepEqual(Object.keys(persisted.inputRedacted).sort(), [
        "callbackRequested",
        "category",
        "hasEmail",
        "hasPhone",
        "preferredChannel",
        "requesterType",
        "service",
      ]);
      assert.doesNotMatch(JSON.stringify(persisted.inputRedacted), /Recette|example\.test|ENT fictif/i);

      const audits = await tx
        .select({ eventType: agentActionAudit.eventType })
        .from(agentActionAudit)
        .where(eq(agentActionAudit.actionId, actionId));
      assert.deepEqual(
        audits.map((audit) => audit.eventType).sort(),
        ["action_created", "action_started", "action_succeeded"]
      );

      const replay = await startSupportCreateRequestAction({
        tx,
        institutionId: context.institutionId,
        grant: verified.actionGrant,
        supportInput,
        requesterRefHash,
        requestIdempotencyHash,
      });
      assert.equal(replay.row.id, actionId);
      assert.equal(replay.needsCompletion, false);
      const replayConfirmation = await completeSupportCreateRequestAction({
        tx,
        action: replay,
        request,
        duplicate: true,
      });
      assert.deepEqual(replayConfirmation, confirmation);

      recipeResult = {
        publicCodeFormat: /^BC-\d{4}-\d{6}$/.test(request.publicCode),
        actionState: persisted.status,
        auditEvents: audits.length,
        idempotentReplay: replay.row.id === actionId,
        minimizedInput: Object.keys(persisted.inputRedacted).length,
      };
      throw ROLLBACK_RECIPE;
    });
  } catch (error) {
    if (error !== ROLLBACK_RECIPE) throw error;
    rolledBack = true;
  }
  assert.equal(rolledBack, true, "The preview action recipe did not roll back");
} finally {
  await cleanupSkill();
}

const after = await fixtureCounts();
assert.deepEqual(after, { skills: 0, sources: 0, actions: 0, requests: 0 });
export const previewRecipeResult = {
  target: "supabase-preview",
  fictional: true,
  featureFlag: isolatedPreviewRuntime ? "isolated-preview-runtime" : "local-recipe-only",
  ...recipeResult,
  rollback: rolledBack,
  cleanup: after,
};
if (cliRun) console.log(JSON.stringify(previewRecipeResult));
