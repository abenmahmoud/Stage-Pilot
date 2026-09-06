// Hard-coded disposable loopback target; never inherits DATABASE_URL or loads .env.
//
// LOT 7 du plan de connaissance OB1 (2026-09-05) : recette sur PostgreSQL réel
// jetable (pile Supabase locale) pour les quatre points du test adverse qui ne
// sont pas exprimables comme un simple appel de fonction pure
// (`scripts/test-knowledge-recall-adverse.mjs`, points 3, 5, 6 et 9).
// Établissement, comptes, actualité, compétences et sources entièrement
// fictifs. Appelle les VRAIS handlers HTTP pour ce qui passe par une route
// (`api/flash/proposals/**`, `api/knowledge/admin/proposals/**`) et la VRAIE
// fonction de construction de contexte pour ce qui n'en a pas
// (`loadPublicKnowledgeContext`, api/_shared/public-knowledge-context.ts) —
// même convention que `scripts/test-local-knowledge-source-proposal-flow.mjs`.
//
// Scénarios :
//  1. (point 3) seule une actualité déjà publiée peut devenir une proposition
//     de connaissance : une actualité seulement validée (pas publiée) est
//     refusée (409), zéro ligne créée ;
//  2. (point 9) idempotence RÉELLEMENT corrigée par ce lot : la même clé
//     d'envoi (`Idempotency-Key`) rejouée deux fois sur une proposition
//     « issue d'une discussion » ne crée jamais une seconde ligne ; une
//     nouvelle clé, même conversation, en crée bien une seconde (portée
//     exacte documentée, pas une déduplication par contenu) ;
//  3. (point 5) une source publiée, courante, requise par une compétence
//     active, mais contestée (`disputed`), n'atteint jamais le contexte réel
//     construit — un témoin (source équivalente non contestée) prouve que
//     l'absence vient bien de la contestation, pas d'un autre défaut ;
//  4. (point 6) deux sources publiées et courantes mais hors audience (service
//     requis absent de l'acteur) ou hors rôle (classification interne pour un
//     visiteur) sont toutes deux exclues du contexte réel construit.

import assert from "node:assert/strict";
import { createHash, createHmac, randomUUID } from "node:crypto";

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

process.env.DATABASE_URL = "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
process.env.VITE_SUPABASE_URL = LOCAL_API_URL;
process.env.SUPABASE_SERVICE_ROLE_KEY = LOCAL_SERVICE_ROLE_KEY;

const marker = randomUUID().replaceAll("-", "").slice(0, 10);
const institutionSlug = `ob1-lot7-recette-${marker}`;
process.env.SUPPORT_INSTITUTION_SLUG = institutionSlug;

const [{ sql, eq, and }, { db }, schema, { createClient }] = await Promise.all([
  import("drizzle-orm"),
  import("../db/index.js"),
  import("../db/schema.js"),
  import("@supabase/supabase-js"),
]);
const proposalsHandler = (await import("../api/flash/proposals/index.js")).default;
const flashDecisionHandler = (await import("../api/flash/proposals/[id]/decision.js")).default;
const knowledgeActivationHandler = (await import("../api/flash/proposals/[id]/knowledge.js")).default;
const conversationProposalHandler = (await import("../api/knowledge/admin/proposals/index.js")).default;
const { loadPublicKnowledgeContext } = await import("../api/_shared/public-knowledge-context.ts");

let assertions = 0;
const check = (actual, expected, label) => {
  try {
    assert.deepEqual(actual, expected);
  } catch (error) {
    error.message = `${label ?? "check"}: got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)} — ${error.message}`;
    throw error;
  }
  assertions++;
};

function createMockResponse() {
  const res = {
    statusCode: 200,
    headersSent: false,
    setHeader() {},
    status(code) {
      res.statusCode = code;
      return res;
    },
    json(data) {
      res._body = data;
      return res;
    },
  };
  return res;
}

async function call(handler, { method = "POST", headers = {}, body = {}, query = {} }) {
  const res = createMockResponse();
  await handler({ method, headers, body, query }, res);
  return { status: res.statusCode, body: res._body };
}

function authHeaders(token, idempotencyKeyValue) {
  const headers = { authorization: `Bearer ${token}` };
  if (idempotencyKeyValue) headers["idempotency-key"] = idempotencyKeyValue;
  return headers;
}

// --- TOTP : même algorithme que scripts/test-local-knowledge-source-proposal-flow.mjs ---
function decodeBase32(value) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const clean = value.toUpperCase().replace(/[^A-Z2-7]/g, "");
  let bits = "";
  for (const character of clean) {
    const index = alphabet.indexOf(character);
    assert.notEqual(index, -1, "Invalid TOTP secret");
    bits += index.toString(2).padStart(5, "0");
  }
  const bytes = [];
  for (let offset = 0; offset + 8 <= bits.length; offset += 8) {
    bytes.push(Number.parseInt(bits.slice(offset, offset + 8), 2));
  }
  return Buffer.from(bytes);
}

function totp(secret) {
  const counter = BigInt(Math.floor(Date.now() / 30_000));
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigUInt64BE(counter);
  const digest = createHmac("sha1", decodeBase32(secret)).update(counterBuffer).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const binary =
    (((digest[offset] & 0x7f) << 24) |
      ((digest[offset + 1] & 0xff) << 16) |
      ((digest[offset + 2] & 0xff) << 8) |
      (digest[offset + 3] & 0xff)) >>>
    0;
  return String(binary % 1_000_000).padStart(6, "0");
}

async function waitForStableTotpWindow() {
  const remaining = 30 - Math.floor((Date.now() / 1000) % 30);
  if (remaining > 4) await new Promise((resolve) => setTimeout(resolve, (remaining + 1) * 1000));
}

const admin = createClient(LOCAL_API_URL, LOCAL_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function createFictionalActor(label, role, password) {
  const email = `ob1-lot7-recette-${marker}-${label}@example.test`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: { role },
  });
  if (error) throw new Error(`create_user_failed:${label}:${error.message}`);
  const anon = createClient(LOCAL_API_URL, LOCAL_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const signIn = await anon.auth.signInWithPassword({ email, password });
  if (signIn.error) throw new Error(`sign_in_failed:${label}:${signIn.error.message}`);
  return { id: data.user.id, email, token: signIn.data.session.access_token, client: anon };
}

const createdUserIds = [];
const institutionId = randomUUID();
const futureIso = (hours) => new Date(Date.now() + hours * 3_600_000).toISOString();
const fixtureHash = (label) => createHash("sha256").update(label, "utf8").digest("hex");

try {
  await db.execute(sql`insert into public.institutions (id, slug, name, status)
    values (${institutionId}::uuid, ${institutionSlug}, 'Lycée fictif recette OB1 LOT7', 'pilot')`);

  const proposer = await createFictionalActor("proposer", "professeur", "recette-lot7-pw-01!");
  const flashValidator = await createFictionalActor("flash-validator", "administration", "recette-lot7-pw-02!");
  const knowledgeManager = await createFictionalActor("knowledge-manager", "proviseur", "recette-lot7-pw-03!");
  createdUserIds.push(proposer.id, flashValidator.id, knowledgeManager.id);

  const membership = (userId, serviceCodes) =>
    db.execute(sql`insert into public.institution_memberships
      (institution_id, user_id, role, service_codes, status)
      values (${institutionId}::uuid, ${userId}::uuid, 'admin', ${sql.raw(
        `array[${serviceCodes.map((code) => `'${code}'`).join(",")}]::text[]`
      )}, 'active')`);

  await membership(proposer.id, []);
  await membership(flashValidator.id, ["referent_numerique"]);
  await membership(knowledgeManager.id, []);

  // --- Session aal2 réelle pour le responsable connaissance : toute requête
  // `requireKnowledgeManager` exige aal2 dans ce dépôt, que `{ publish: true }`
  // soit demandé ou non (découverte du LOT 5, revérifiée ici). ---
  await waitForStableTotpWindow();
  const enrollment = await knowledgeManager.client.auth.mfa.enroll({
    factorType: "totp",
    friendlyName: "Recette OB1 LOT7",
  });
  if (enrollment.error || !enrollment.data?.totp?.secret) {
    throw new Error(`mfa_enrollment_failed:${enrollment.error?.message ?? "no_secret"}`);
  }
  const challenge = await knowledgeManager.client.auth.mfa.challenge({ factorId: enrollment.data.id });
  if (challenge.error) throw challenge.error;
  const verify = await knowledgeManager.client.auth.mfa.verify({
    factorId: enrollment.data.id,
    challengeId: challenge.data.id,
    code: totp(enrollment.data.totp.secret),
  });
  if (verify.error) throw verify.error;
  const assurance = await knowledgeManager.client.auth.mfa.getAuthenticatorAssuranceLevel();
  check(assurance.data?.currentLevel, "aal2", "knowledge_manager_reaches_aal2");
  const { data: sessionData } = await knowledgeManager.client.auth.getSession();
  const knowledgeManagerAal2Token = sessionData.session.access_token;

  // ===========================================================================
  // Scénario 1 (point 3) : seule une actualité déjà publiée peut devenir une
  // proposition de connaissance.
  // ===========================================================================
  const proposeBody = {
    title: `Actualité fictive OB1 LOT7 ${marker}`,
    bodyMarkdown: `Contenu fictif de l'actualité seulement validée ${marker}, sans donnée personnelle.`,
    importance: "normale",
    channels: [],
    groupRefs: ["public:site"],
    expiresAt: futureIso(72),
  };
  const proposed = await call(proposalsHandler, {
    headers: authHeaders(proposer.token, `ob1-lot7-recette-${marker}-flash`),
    body: proposeBody,
  });
  if (proposed.status !== 201) throw new Error(`flash_propose_failed:${proposed.status}:${JSON.stringify(proposed.body)}`);
  const flashInfoId = proposed.body.version.flashInfoId;
  const decided = await call(flashDecisionHandler, {
    headers: authHeaders(flashValidator.token),
    query: { id: flashInfoId },
    body: { decision: "validee", content: null },
  });
  check(decided.status, 200, "flash_decision_status");
  check(decided.body.version.status, "validee", "flash_decision_leaves_actuality_not_published");

  const activationOnNonPublished = await call(knowledgeActivationHandler, {
    headers: authHeaders(knowledgeManagerAal2Token),
    query: { id: flashInfoId },
    body: { classification: "public", serviceCodes: [], provenanceStatus: "imported", usePolicy: "can_use_as_instruction" },
  });
  check(activationOnNonPublished.status, 409, "activation_refused_on_validee_not_publiee");

  const [{ count: proposalsForFlashInfo }] = await db.execute(
    sql`select count(*)::int as count from public.knowledge_source_proposals where origin_flash_info_id = ${flashInfoId}::uuid`
  );
  check(proposalsForFlashInfo, 0, "zero_proposal_created_for_a_non_published_actuality");

  // ===========================================================================
  // Scénario 2 (point 9) : idempotence corrigée par ce lot pour une
  // proposition « issue d'une discussion ». Portée exacte : la MÊME clé
  // d'envoi rejouée deux fois ne crée jamais une seconde ligne ; une NOUVELLE
  // clé (nouvel envoi réel, même conversation) en crée bien une seconde — ce
  // n'est pas une déduplication par contenu, seulement une protection contre
  // le double envoi (même motif que `api/flash/proposals/index.ts`).
  // ===========================================================================
  const conversationId = randomUUID();
  const conversationBody = {
    conversationId,
    title: `Observation fictive de conversation ${marker}`,
    candidateText: `Un usager a mentionné un horaire fictif pendant l'échange ${marker}, sans donnée personnelle.`,
    classification: "internal",
    serviceCodes: ["vie_scolaire"],
    validFrom: new Date().toISOString(),
    expiresAt: futureIso(24 * 30),
    provenanceStatus: "observed",
    usePolicy: "do_not_inject_automatically",
  };
  const firstKey = `ob1-lot7-recette-${marker}-conv-first`;
  const firstSubmission = await call(conversationProposalHandler, {
    headers: authHeaders(knowledgeManagerAal2Token, firstKey),
    body: conversationBody,
  });
  check(firstSubmission.status, 200, "first_conversation_submission_status");
  check(firstSubmission.body.duplicate, false, "first_conversation_submission_is_not_a_duplicate");
  const firstProposalId = firstSubmission.body.proposal.id;

  const replaySubmission = await call(conversationProposalHandler, {
    headers: authHeaders(knowledgeManagerAal2Token, firstKey),
    body: conversationBody,
  });
  check(replaySubmission.status, 200, "replayed_conversation_submission_status");
  check(replaySubmission.body.duplicate, true, "replayed_conversation_submission_is_flagged_duplicate");
  check(replaySubmission.body.proposal.id, firstProposalId, "replayed_conversation_submission_returns_the_same_proposal");

  const [{ count: rowsAfterReplay }] = await db.execute(
    sql`select count(*)::int as count from public.knowledge_source_proposals where origin_conversation_id = ${conversationId}::uuid`
  );
  check(rowsAfterReplay, 1, "exactly_one_row_after_the_same_key_is_replayed");

  const secondKey = `ob1-lot7-recette-${marker}-conv-second`;
  const secondSubmission = await call(conversationProposalHandler, {
    headers: authHeaders(knowledgeManagerAal2Token, secondKey),
    body: conversationBody,
  });
  check(secondSubmission.status, 200, "second_real_submission_status");
  check(secondSubmission.body.duplicate, false, "second_real_submission_with_a_new_key_is_not_a_duplicate");
  assert.notEqual(secondSubmission.body.proposal.id, firstProposalId, "second_real_submission_creates_a_distinct_proposal");
  assertions++;

  const [{ count: rowsAfterSecondKey }] = await db.execute(
    sql`select count(*)::int as count from public.knowledge_source_proposals where origin_conversation_id = ${conversationId}::uuid`
  );
  check(rowsAfterSecondKey, 2, "a_genuinely_new_envelope_still_creates_a_second_row");

  // ===========================================================================
  // Scénarios 3 et 4 (points 5 et 6) : sources publiées et courantes, requises
  // par une compétence active, exclues du contexte réel construit.
  // ===========================================================================
  const ownerUserId = knowledgeManager.id;
  const past = new Date(Date.now() - 3_600_000);
  const future = new Date(futureIso(24 * 30));

  async function insertSource(label, overrides) {
    const [row] = await db
      .insert(schema.knowledgeSources)
      .values({
        institutionId,
        title: `Source fictive ${label} ${marker}`,
        sourceType: "official_url",
        uri: `internal://lot7-fixture/${label}`,
        classification: "public",
        ownerUserId,
        serviceCodes: [],
        validFrom: past,
        expiresAt: future,
        status: "published",
        checksum: fixtureHash(`lot7-fixture-${label}`),
        provenanceStatus: "imported",
        usePolicy: "can_use_as_instruction",
        ...overrides,
      })
      .returning();
    return row;
  }

  async function insertSkill(label, sourceId) {
    const skillKey = `lot7fixture${label}${marker}`;
    const [skill] = await db
      .insert(schema.agentSkills)
      .values({
        institutionId,
        skillKey,
        name: `Assistance fictive ${skillKey}`,
        domain: "Vie scolaire",
        enabled: true,
      })
      .returning();
    const [version] = await db
      .insert(schema.agentSkillVersions)
      .values({
        institutionId,
        skillId: skill.id,
        version: "1.0.0",
        status: "published",
        definition: {
          instructions: `Pour une question fictive ${skillKey}, orienter vers la source associée.`,
          allowedTools: [],
        },
        contentHash: fixtureHash(`lot7-fixture-version-${label}`),
        dataClassification: "public",
        createdBy: ownerUserId,
        approvedBy: ownerUserId,
        publishedAt: past,
        reviewDueAt: future,
      })
      .returning();
    await db
      .update(schema.agentSkills)
      .set({ activeVersionId: version.id })
      .where(eq(schema.agentSkills.id, skill.id));
    await db.insert(schema.skillSourceLinks).values({ institutionId, skillVersionId: version.id, sourceId, required: true });
    return { skillKey, name: `Assistance fictive ${skillKey}` };
  }

  // Témoin : source non contestée, non restreinte -> prouve que le mécanisme
  // de rappel fonctionne normalement dans cette recette avant de démontrer
  // les trois exclusions.
  const baselineSource = await insertSource("baseline", {});
  const baselineSkill = await insertSkill("baseline", baselineSource.id);

  // Point 5 : source contestée (disputed), publiée, courante, requise.
  const disputedSource = await insertSource("disputed", { provenanceStatus: "disputed" });
  const disputedSkill = await insertSkill("disputed", disputedSource.id);

  // Point 6a : hors audience (service requis absent de l'acteur). Classification
  // 'internal' (pas 'public') : la contrainte de la migration interdit une
  // source publique restreinte a un service (meme regle que sur
  // knowledge_source_proposals) ; l'acteur interne ci-dessous satisferait
  // cette classification, ce qui isole bien l'exclusion sur le seul service.
  const horsServiceSource = await insertSource("horsservice", {
    classification: "internal",
    serviceCodes: ["intendance"],
  });
  const horsServiceSkill = await insertSkill("horsservice", horsServiceSource.id);

  // Point 6b : hors rôle (classification interne, acteur visiteur I0).
  const horsRoleSource = await insertSource("horsrole", { classification: "internal" });
  const horsRoleSkill = await insertSkill("horsrole", horsRoleSource.id);

  const internalAgentActor = {
    identityLevel: "I3",
    role: "agent",
    institutionId,
    serviceCodes: ["vie_scolaire"],
  };
  const visitorActor = {
    identityLevel: "I0",
    role: "visitor",
    institutionId,
    serviceCodes: [],
  };

  const queryForInternalAgent = `Question fictive ${baselineSkill.skillKey} ${disputedSkill.skillKey} ${horsServiceSkill.skillKey}`;
  const contextForInternalAgent = await loadPublicKnowledgeContext({
    query: queryForInternalAgent,
    actor: internalAgentActor,
    now: new Date(),
  });
  check(
    contextForInternalAgent.instructions.includes(baselineSkill.name),
    true,
    "baseline_skill_reaches_the_real_context_for_an_authorized_actor"
  );
  check(
    contextForInternalAgent.instructions.includes(disputedSkill.name),
    false,
    "disputed_source_excludes_its_dependent_skill_from_the_real_context"
  );
  check(
    contextForInternalAgent.instructions.includes(horsServiceSkill.name),
    false,
    "out_of_service_scope_source_excludes_its_dependent_skill_from_the_real_context"
  );

  const queryForVisitor = `Question fictive ${baselineSkill.skillKey} ${horsRoleSkill.skillKey}`;
  const contextForVisitor = await loadPublicKnowledgeContext({
    query: queryForVisitor,
    actor: visitorActor,
    now: new Date(),
  });
  check(
    contextForVisitor.instructions.includes(baselineSkill.name),
    true,
    "baseline_skill_still_reaches_the_real_context_for_a_visitor_because_it_is_public"
  );
  check(
    contextForVisitor.instructions.includes(horsRoleSkill.name),
    false,
    "out_of_role_classification_excludes_its_dependent_skill_from_the_real_context_for_a_visitor"
  );

  console.log(
    JSON.stringify(
      {
        target: "127.0.0.1:54322",
        assertions,
        outcome: "pass",
      },
      null,
      2
    )
  );
} finally {
  for (const userId of createdUserIds) {
    await admin.auth.admin.deleteUser(userId).catch(() => {});
  }
  try {
    await db.delete(schema.institutions).where(eq(schema.institutions.id, institutionId));
  } catch {
    // Best-effort: this is a disposable local stack.
  }
}
