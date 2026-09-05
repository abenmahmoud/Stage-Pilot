// Hard-coded disposable loopback target; never inherits DATABASE_URL or loads .env.
//
// LOT 4 du plan de connaissance OB1 (2026-09-05) : recette sur PostgreSQL réel
// jetable (pile Supabase locale). Établissement, compte et compétence
// entièrement fictifs. Preuve exigée par le plan sur le contexte et la trace
// RÉELLEMENT CONSTRUITS (pas sur une relecture du code) :
//   - une source retenue (`can_use_as_evidence`, toujours citée quelle que
//     soit la sélection de compétence) porte, dans `agent_skill_audit`, son
//     devenir "retained", le motif LOT 2 qui autorise l'usage, la politique
//     et l'empreinte de contenu (version) de la source ;
//   - une source écartée (`expired`) porte son motif d'exclusion LOT 2
//     ("source_expired") au lieu de disparaître silencieusement ;
//   - un balayage (`JSON.stringify` de toutes les lignes insérées, pas une
//     relecture du code) ne fait apparaître ni la question posée, ni un
//     fragment sensible qu'elle contient, ni le hash de session en clair.

import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";

if (process.argv.length !== 3 || process.argv[2] !== "--local-stack-only") {
  throw new Error("local_stack_confirmation_required");
}

const LOCAL_API_URL = "http://127.0.0.1:54321";
// Clés de démonstration publiques du CLI Supabase local (identiques sur toute
// pile locale par défaut) ; jamais des secrets réels.
const LOCAL_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";
const LOCAL_SERVICE_ROLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

const marker = randomUUID().replaceAll("-", "").slice(0, 10);
const institutionSlug = `ob1-lot4-recette-${marker}`;

process.env.DATABASE_URL = "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
process.env.SUPPORT_INSTITUTION_SLUG = institutionSlug;

const [{ and, eq, inArray }, { db }, schema, { createClient }] = await Promise.all([
  import("drizzle-orm"),
  import("../db/index.js"),
  import("../db/schema.js"),
  import("@supabase/supabase-js"),
]);
const { loadPublicKnowledgeContext, recordPublicKnowledgeUsage } = await import(
  "../api/_shared/public-knowledge-context.ts"
);

let assertions = 0;
const check = (actual, expected, message) => {
  assert.deepEqual(actual, expected, message);
  assertions++;
};

const admin = createClient(LOCAL_API_URL, LOCAL_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const ownerEmail = `ob1-lot4-recette-${marker}@example.test`;
const { data: ownerUser, error: ownerError } = await admin.auth.admin.createUser({
  email: ownerEmail,
  password: `${randomUUID()}Aa1!`,
  email_confirm: true,
  app_metadata: { role: "agent" },
});
if (ownerError) throw new Error(`create_owner_failed:${ownerError.message}`);
const ownerId = ownerUser.user.id;

const now = new Date("2026-09-06T12:00:00.000Z");
const past = new Date("2026-08-01T00:00:00.000Z");
const future = new Date("2026-12-31T23:59:59.000Z");
const rejectedValidFrom = new Date("2025-01-01T00:00:00.000Z");
const longExpired = new Date("2026-01-01T00:00:00.000Z");

const institutionId = randomUUID();
const retainedSourceId = randomUUID();
const rejectedSourceId = randomUUID();
const skillId = randomUUID();
const versionId = randomUUID();

// Fragment fictif "sensible" : ni un vrai code, ni une vraie donnée
// personnelle, seulement un motif reconnaissable dans un balayage.
const SENSITIVE_FRAGMENT = `code-eleve-fictif-${marker}`;
const RETAINED_TITLE = `Procédure ENT fictive citée en preuve ${marker}`;
const REJECTED_TITLE = `Note interne fictive expirée ${marker}`;
const QUERY = `Mon ${SENSITIVE_FRAGMENT} pour l'ENT ne fonctionne plus, contact eleve.fictif+${marker}@example.test`;
const INSTRUCTIONS_TEXT = `Compétence fictive de secours ${marker}, jamais réellement sélectionnée par cette recette.`;

const retainedChecksum = createHash("sha256").update(`fictif-checksum-retained-${marker}`).digest("hex");
const rejectedChecksum = createHash("sha256").update(`fictif-checksum-rejected-${marker}`).digest("hex");
const sessionHash = createHash("sha256").update(`fictif-session-${marker}`).digest("hex");

try {
  await db.insert(schema.institutions).values({
    id: institutionId,
    slug: institutionSlug,
    name: `Etablissement fictif LOT4 ${marker}`,
    status: "active",
  });

  await db.insert(schema.knowledgeSources).values([
    {
      id: retainedSourceId,
      institutionId,
      title: RETAINED_TITLE,
      sourceType: "procedure",
      uri: `fictif://ob1-lot4/retained/${marker}`,
      classification: "public",
      ownerUserId: ownerId,
      serviceCodes: [],
      validFrom: past,
      expiresAt: future,
      status: "published",
      checksum: retainedChecksum,
      usePolicy: "can_use_as_evidence",
    },
    {
      id: rejectedSourceId,
      institutionId,
      title: REJECTED_TITLE,
      sourceType: "procedure",
      uri: `fictif://ob1-lot4/rejected/${marker}`,
      classification: "public",
      ownerUserId: ownerId,
      serviceCodes: [],
      validFrom: rejectedValidFrom,
      expiresAt: longExpired,
      status: "expired",
      checksum: rejectedChecksum,
    },
  ]);

  await db.insert(schema.agentSkills).values({
    id: skillId,
    institutionId,
    skillKey: `assistance-recall-fictif-${marker}`,
    name: `Assistance fictive ${marker}`,
    domain: "Accès numérique",
    enabled: true,
    activeVersionId: null,
  });

  await db.insert(schema.agentSkillVersions).values({
    id: versionId,
    institutionId,
    skillId,
    version: "1.0.0",
    status: "published",
    definition: { instructions: INSTRUCTIONS_TEXT, allowedTools: [] },
    contentHash: createHash("sha256").update(`fictif-content-hash-${marker}`).digest("hex"),
    dataClassification: "public",
    createdBy: ownerId,
    approvedBy: ownerId,
    publishedAt: past,
    reviewDueAt: future,
  });

  await db
    .update(schema.agentSkills)
    .set({ activeVersionId: versionId })
    .where(eq(schema.agentSkills.id, skillId));

  // Les deux sources sont liées à la même compétence, non requises : leur
  // devenir dans la trace ne dépend pas de la sélection de la compétence
  // (le chemin `evidence` est inconditionnel, cf. LOT 3), seulement de
  // `decideKnowledgeSourceUsage` (LOT 2).
  await db.insert(schema.skillSourceLinks).values([
    { institutionId, skillVersionId: versionId, sourceId: retainedSourceId, required: false },
    { institutionId, skillVersionId: versionId, sourceId: rejectedSourceId, required: false },
  ]);

  const loaded = await loadPublicKnowledgeContext({ query: QUERY, now });

  const recallBySourceId = new Map(loaded.recalledSources.map((entry) => [entry.sourceId, entry]));
  check(recallBySourceId.size, 2, "both proposed sources reach the recall trace");
  check(
    recallBySourceId.get(retainedSourceId),
    {
      sourceId: retainedSourceId,
      institutionId,
      outcome: "retained",
      reasonCode: "policy_allows_cited_evidence",
      usePolicy: "can_use_as_evidence",
      sourceVersion: retainedChecksum,
    },
    "the evidence source is retained with its authorizing policy motif and version"
  );
  check(
    recallBySourceId.get(rejectedSourceId),
    {
      sourceId: rejectedSourceId,
      institutionId,
      outcome: "rejected",
      reasonCode: "source_expired",
      usePolicy: "can_use_as_instruction",
      sourceVersion: rejectedChecksum,
    },
    "the expired source is rejected with the LOT 2 exclusion motif"
  );

  await recordPublicKnowledgeUsage({
    versions: loaded.versions,
    recalledSources: loaded.recalledSources,
    sessionHash,
    model: "fictif-model-recette",
    turnCount: 1,
  });

  const auditRows = await db
    .select({
      resourceType: schema.agentSkillAudit.resourceType,
      resourceId: schema.agentSkillAudit.resourceId,
      action: schema.agentSkillAudit.action,
      actorId: schema.agentSkillAudit.actorId,
      summary: schema.agentSkillAudit.summary,
    })
    .from(schema.agentSkillAudit)
    .where(
      and(
        eq(schema.agentSkillAudit.institutionId, institutionId),
        inArray(schema.agentSkillAudit.resourceId, [retainedSourceId, rejectedSourceId])
      )
    );

  check(auditRows.length, 2, "both proposed sources were persisted to the recall trace");
  const auditBySourceId = new Map(auditRows.map((row) => [row.resourceId, row]));
  for (const row of auditRows) {
    check(row.resourceType, "source", "each row is attributed to a source, not a version");
    check(row.action, "consult_public", "each row keeps the existing audit action");
    check(row.actorId, null, "no individual actor is attributed to a public recall");
  }
  check(
    Object.keys(auditBySourceId.get(retainedSourceId).summary).sort(),
    ["channel", "model", "outcome", "reasonCode", "sessionHash", "sourceVersion", "turnCount", "usePolicy"],
    "the persisted summary carries the LOT 4 fields alongside the existing ones"
  );
  check(auditBySourceId.get(retainedSourceId).summary.outcome, "retained");
  check(auditBySourceId.get(retainedSourceId).summary.reasonCode, "policy_allows_cited_evidence");
  check(auditBySourceId.get(retainedSourceId).summary.sourceVersion, retainedChecksum);
  check(auditBySourceId.get(rejectedSourceId).summary.outcome, "rejected");
  check(auditBySourceId.get(rejectedSourceId).summary.reasonCode, "source_expired");
  check(auditBySourceId.get(rejectedSourceId).summary.sessionHash, sessionHash);

  // Balayage (pas une relecture) : la question posée, son fragment sensible
  // et l'adresse fictive qu'elle contient ne doivent apparaître nulle part
  // dans ce qui a été réellement inséré en base.
  const sweptText = JSON.stringify(auditRows);
  check(sweptText.includes(QUERY), false, "the raw question never enters the trace");
  check(sweptText.includes(SENSITIVE_FRAGMENT), false, "no sensitive fragment from the question enters the trace");
  check(/[\w.+-]+@[\w-]+\.[\w.-]+/i.test(sweptText), false, "no email-shaped value enters the trace");
  check(sweptText.includes(QUERY.trim()), false, "no verbatim question substring enters the trace");

  console.log(JSON.stringify({ target: "127.0.0.1:54322", assertions, outcome: "pass" }, null, 2));
} finally {
  try {
    await db.delete(schema.institutions).where(eq(schema.institutions.id, institutionId));
  } catch {
    // Best-effort: this is a disposable local stack.
  }
  try {
    await admin.auth.admin.deleteUser(ownerId);
  } catch {
    // Best-effort: this is a disposable local stack.
  }
}
