// Hard-coded disposable loopback target; never inherits DATABASE_URL or loads .env.
//
// LOT 3 du plan de connaissance OB1 (2026-09-05) : recette sur PostgreSQL réel
// jetable (pile Supabase locale). Établissement et compte entièrement
// fictifs. Vérifie sur le contexte RÉELLEMENT CONSTRUIT par
// `loadPublicKnowledgeContext` (pas sur une relecture du code) qu'une source
// requise, une fois basculée en `can_use_as_evidence`, cesse d'apparaître
// dans la partie instructions du contexte et apparaît dans la partie
// preuves. N'appelle aucun outil du coffre de codes.

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
const institutionSlug = `ob1-lot3-recette-${marker}`;

process.env.DATABASE_URL = "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
process.env.SUPPORT_INSTITUTION_SLUG = institutionSlug;

const [{ eq }, { db }, schema, { createClient }] = await Promise.all([
  import("drizzle-orm"),
  import("../db/index.js"),
  import("../db/schema.js"),
  import("@supabase/supabase-js"),
]);
const { loadPublicKnowledgeContext } = await import("../api/_shared/public-knowledge-context.ts");

let assertions = 0;
const check = (actual, expected, message) => {
  assert.deepEqual(actual, expected, message);
  assertions++;
};

const admin = createClient(LOCAL_API_URL, LOCAL_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const ownerEmail = `ob1-lot3-recette-${marker}@example.test`;
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

const institutionId = randomUUID();
const sourceId = randomUUID();
const skillId = randomUUID();
const versionId = randomUUID();

const SKILL_NAME = `Assistance ENT fictive ${marker}`;
const SOURCE_TITLE = `Procédure ENT fictive de rentrée ${marker}`;
const QUERY = `Mon accès ENT fictif ${marker} ne fonctionne plus`;
const INSTRUCTIONS_TEXT =
  `Pour un blocage ENT fictif ${marker}, vérifier le navigateur puis préparer un dossier si le problème persiste.`;

async function loadContext() {
  return loadPublicKnowledgeContext({ query: QUERY, now });
}

try {
  await db.insert(schema.institutions).values({
    id: institutionId,
    slug: institutionSlug,
    name: `Etablissement fictif LOT3 ${marker}`,
    status: "active",
  });

  await db.insert(schema.knowledgeSources).values({
    id: sourceId,
    institutionId,
    title: SOURCE_TITLE,
    sourceType: "procedure",
    uri: `fictif://ob1-lot3/${marker}`,
    classification: "public",
    ownerUserId: ownerId,
    serviceCodes: [],
    validFrom: past,
    expiresAt: future,
    status: "published",
    checksum: createHash("sha256").update(`fictif-checksum-${marker}`).digest("hex"),
    // provenanceStatus / usePolicy laissés aux valeurs par défaut de la
    // migration LOT 1 ('imported' / 'can_use_as_instruction') pour le premier
    // appel : comportement historique exactement préservé.
  });

  await db.insert(schema.agentSkills).values({
    id: skillId,
    institutionId,
    skillKey: `assistance-ent-fictif-${marker}`,
    name: SKILL_NAME,
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

  await db.insert(schema.skillSourceLinks).values({
    institutionId,
    skillVersionId: versionId,
    sourceId,
    required: true,
  });

  // --- Étape 1 : source encore `can_use_as_instruction` (défaut LOT 1). ---
  const beforeContext = await loadContext();
  check(
    beforeContext.instructions.includes("<registre_autorise_valide>"),
    true,
    "before: instruction registry present"
  );
  check(
    beforeContext.instructions.includes(SKILL_NAME),
    true,
    "before: skill instructions reach the model"
  );
  check(
    beforeContext.instructions.includes(SOURCE_TITLE),
    true,
    "before: required source is cited inside the instruction registry"
  );
  check(
    beforeContext.instructions.includes("<sources_citees_comme_preuve>"),
    false,
    "before: no evidence citation block yet"
  );
  check(
    beforeContext.sources.some((source) => source.sourceId === sourceId),
    false,
    "before: no excerpt row is seeded in this recipe, so the audit list stays empty " +
      "(the required source already reaches the model, just inside the instruction " +
      "registry, not the audit list — that list is fed by matched excerpts or, from " +
      "this lot on, by evidence citations)"
  );

  // --- Étape 2 : bascule réelle en base, use_policy -> can_use_as_evidence. ---
  await db
    .update(schema.knowledgeSources)
    .set({ usePolicy: "can_use_as_evidence" })
    .where(eq(schema.knowledgeSources.id, sourceId));

  const afterContext = await loadContext();
  check(
    afterContext.instructions.includes("<registre_autorise_valide>"),
    false,
    "after: instruction registry disappears (its only required source no longer backs a consigne)"
  );
  check(
    afterContext.instructions.includes(SKILL_NAME),
    false,
    "after: the skill's instructions no longer reach the model"
  );
  check(
    afterContext.instructions.includes("<sources_citees_comme_preuve>"),
    true,
    "after: the evidence citation block now appears"
  );
  check(
    afterContext.instructions.includes(SOURCE_TITLE),
    true,
    "after: the source is still cited, but only inside the evidence block"
  );
  check(
    afterContext.sources.some((source) => source.sourceId === sourceId),
    true,
    "after: source still recorded for audit (now via the evidence path)"
  );

  console.log(JSON.stringify({ target: "127.0.0.1:54322", assertions, outcome: "pass" }, null, 2));
} finally {
  // Nettoyage : l'établissement fictif cascade sur ses sources, skills,
  // versions et liens. Le compte auth.users fictif est supprimé séparément
  // via l'API admin (best-effort, comme les autres recettes locales du dépôt).
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
