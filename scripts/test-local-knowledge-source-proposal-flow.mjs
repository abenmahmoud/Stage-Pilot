// Hard-coded disposable loopback target; never inherits DATABASE_URL or loads .env.
//
// LOT 5 du plan de connaissance OB1 (2026-09-05) : recette sur PostgreSQL
// réel jetable (pile Supabase locale). Établissement, comptes, actualité et
// compétence entièrement fictifs. Appelle les VRAIS handlers HTTP
// (`api/flash/proposals/**`, `api/knowledge/admin/proposals/**`) avec un
// req/res minimal et des jetons réels émis par le GoTrue local (session aal2
// réellement enrôlée en TOTP pour la seconde validation, jamais un JWT
// fabriqué à la main) — pas de réimplémentation des règles métier, même
// convention que `scripts/test-flash-correction-recette.mjs`.
//
// Scénarios :
//  1. bootstrap d'une actualité réellement publiée (VRAIS handlers flash) ;
//  2. « Rendre utilisable par l'agent » (décision A, sans aal2) ;
//  3. tentative d'approbation par un acteur SANS aal2 -> refusée (403) ;
//  4. seconde validation avec une session aal2 réelle -> source publiée ;
//  5. la source liée à une compétence atteint réellement le contexte de
//     l'agent (`loadPublicKnowledgeContext`) ;
//  6. correction RÉELLE de l'actualité -> la source dérivée est révoquée
//     IMMÉDIATEMENT et disparaît du contexte réel ;
//  7. une proposition « issue d'une discussion » contenant un email est
//     expurgée (texte retiré) et ne peut jamais être approuvée ;
//  8. les contraintes de la migration rejettent les combinaisons interdites.

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
const institutionSlug = `ob1-lot5-recette-${marker}`;
process.env.SUPPORT_INSTITUTION_SLUG = institutionSlug;

const [{ sql, eq }, { db }, schema, { createClient }] = await Promise.all([
  import("drizzle-orm"),
  import("../db/index.js"),
  import("../db/schema.js"),
  import("@supabase/supabase-js"),
]);
const proposalsHandler = (await import("../api/flash/proposals/index.js")).default;
const flashDecisionHandler = (await import("../api/flash/proposals/[id]/decision.js")).default;
const publicationHandler = (await import("../api/flash/proposals/[id]/publication.js")).default;
const correctionHandler = (await import("../api/flash/proposals/[id]/correction.js")).default;
const knowledgeActivationHandler = (await import("../api/flash/proposals/[id]/knowledge.js")).default;
const proposalDecisionHandler = (await import("../api/knowledge/admin/proposals/[id]/decision.js")).default;
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

function authHeaders(token, idempotencyKey) {
  const headers = { authorization: `Bearer ${token}` };
  if (idempotencyKey) headers["idempotency-key"] = idempotencyKey;
  return headers;
}

// --- TOTP : même algorithme que scripts/test-flash-publication-browser-recette.mjs ---
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
  const email = `ob1-lot5-recette-${marker}-${label}@example.test`;
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

try {
  await db.execute(sql`insert into public.institutions (id, slug, name, status)
    values (${institutionId}::uuid, ${institutionSlug}, 'Lycée fictif recette OB1 LOT5', 'pilot')`);

  const proposer = await createFictionalActor("proposer", "professeur", "recette-lot5-pw-01!");
  const flashValidator = await createFictionalActor("flash-validator", "administration", "recette-lot5-pw-02!");
  const knowledgeManager = await createFictionalActor("knowledge-manager", "proviseur", "recette-lot5-pw-03!");
  createdUserIds.push(proposer.id, flashValidator.id, knowledgeManager.id);

  // Le role de cette table est toujours 'admin' dans cette recette (comme
  // dans scripts/test-flash-correction-recette.mjs) : c'est le role JWT
  // (app_metadata.role, ci-dessus) qui distingue les acteurs, pas le role de
  // la ligne d'adhesion.
  const membership = (userId, serviceCodes) =>
    db.execute(sql`insert into public.institution_memberships
      (institution_id, user_id, role, service_codes, status)
      values (${institutionId}::uuid, ${userId}::uuid, 'admin', ${sql.raw(
        `array[${serviceCodes.map((code) => `'${code}'`).join(",")}]::text[]`
      )}, 'active')`);

  await membership(proposer.id, []);
  await membership(flashValidator.id, ["referent_numerique"]);
  await membership(knowledgeManager.id, []);

  // --- Session aal2 réelle pour le responsable connaissance (TOTP réellement
  // enrôlé et vérifié), utilisée seulement pour la seconde validation. ---
  await waitForStableTotpWindow();
  const enrollment = await knowledgeManager.client.auth.mfa.enroll({
    factorType: "totp",
    friendlyName: "Recette OB1 LOT5",
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
  // Le token capturé AVANT l'enrôlement MFA reste valide côté GoTrue (session
  // non révoquée) mais son assurance level est aal1 : utilisé ci-dessous pour
  // prouver le refus. Découverte faite en exécutant cette recette (pas
  // supposée à l'avance) : `requireRole` (api/_shared/auth.ts) exige déjà
  // aal2 pour TOUT appel de `superadmin`/`administration`/`agent`/`proviseur`
  // — donc pour `requireSupportAgent`/`requireKnowledgeManager` — que
  // l'option `{ publish: true }` soit demandée ou non. Les deux décisions du
  // plan (« rendre utilisable » et la seconde validation) exigent donc
  // aujourd'hui toutes les deux une session aal2 réelle dans ce dépôt ; ce
  // n'est pas une distinction que ce lot introduit ou peut retirer.
  const knowledgeManagerAal1Token = knowledgeManager.token;

  // === Scénario 1 : bootstrap d'une actualité réellement publiée (VRAIS
  // handlers flash, mêmes routes que l'écran). ===
  const proposeBody = {
    title: `Actualité fictive OB1 LOT5 ${marker}`,
    bodyMarkdown: `Contenu fictif de l'actualité publiée ${marker}, sans donnée personnelle.`,
    importance: "normale",
    channels: [],
    groupRefs: ["public:site"],
    expiresAt: futureIso(72),
  };
  const proposed = await call(proposalsHandler, {
    headers: authHeaders(proposer.token, `ob1-lot5-recette-${marker}`),
    body: proposeBody,
  });
  if (proposed.status !== 201) throw new Error(`flash_propose_failed:${proposed.status}:${JSON.stringify(proposed.body)}`);
  const flashInfoId = proposed.body.version.flashInfoId;
  const decided = await call(flashDecisionHandler, {
    headers: authHeaders(flashValidator.token),
    query: { id: flashInfoId },
    body: { decision: "validee", content: null },
  });
  if (decided.status !== 200) throw new Error(`flash_decision_failed:${decided.status}:${JSON.stringify(decided.body)}`);
  const published = await call(publicationHandler, {
    headers: authHeaders(flashValidator.token),
    query: { id: flashInfoId },
  });
  check(published.status, 200, "flash_publish_status");
  check(published.body.version.status, "publiee", "flash_publish_status_field");

  // === Scénario 2 : « Rendre utilisable par l'agent » (décision A) — exige
  // aal2 comme toute requête `requireKnowledgeManager` dans ce dépôt (voir la
  // note ci-dessus). ===
  const activation = await call(knowledgeActivationHandler, {
    headers: authHeaders(knowledgeManagerAal2Token),
    query: { id: flashInfoId },
    body: { classification: "public", serviceCodes: [], provenanceStatus: "imported", usePolicy: "can_use_as_instruction" },
  });
  check(activation.status, 200, "knowledge_activation_status");
  check(activation.body.status, "pending_review", "knowledge_activation_pending");
  check(activation.body.privacySignalCount, 0, "knowledge_activation_no_privacy_signal");
  const proposalId = activation.body.proposalId;

  // Une seconde tentative sur la même actualité, avant toute décision, est
  // refusée (une seule proposition active à la fois).
  const duplicateActivation = await call(knowledgeActivationHandler, {
    headers: authHeaders(knowledgeManagerAal2Token),
    query: { id: flashInfoId },
    body: { classification: "public", serviceCodes: [], provenanceStatus: "imported", usePolicy: "can_use_as_instruction" },
  });
  check(duplicateActivation.status, 409, "duplicate_activation_rejected");

  // === Scénario 3 : tentative d'approbation SANS aal2 -> refusée. ===
  const approveWithoutAal2 = await call(proposalDecisionHandler, {
    headers: authHeaders(knowledgeManagerAal1Token),
    query: { id: proposalId },
    body: { action: "approve", note: "Tentative sans double vérification, doit échouer." },
  });
  check(approveWithoutAal2.status, 403, "approve_without_aal2_rejected");

  // === Scénario 4 : seconde validation avec une session aal2 RÉELLE. ===
  const approved = await call(proposalDecisionHandler, {
    headers: authHeaders(knowledgeManagerAal2Token),
    query: { id: proposalId },
    body: { action: "approve", note: "Contenu vérifié, conforme au bulletin publié." },
  });
  check(approved.status, 200, "approve_with_aal2_status");
  check(approved.body.status, "approved", "approve_with_aal2_body_status");
  const sourceId = approved.body.sourceId;
  assert.ok(sourceId, "approve_returns_source_id");
  assertions++;

  const [sourceRow] = await db
    .select()
    .from(schema.knowledgeSources)
    .where(eq(schema.knowledgeSources.id, sourceId))
    .limit(1);
  check(sourceRow.status, "published", "source_row_published_directly_not_draft");
  check(sourceRow.sourceType, "flash_publication", "source_row_type");
  check(sourceRow.provenanceStatus, "imported", "source_row_provenance");
  check(sourceRow.usePolicy, "can_use_as_instruction", "source_row_use_policy");
  check(sourceRow.expiresAt.toISOString(), published.body.version.expiresAt, "source_expiry_copied_from_flash_version");

  // === Scénario 5 : la source liée à une compétence atteint réellement le
  // contexte de l'agent. ===
  const skillId = randomUUID();
  const versionId = randomUUID();
  const skillName = `Assistance fictive OB1 LOT5 ${marker}`;
  const instructionsText = `Pour une question fictive OB1 LOT5 ${marker}, orienter vers l'actualité publiée.`;
  await db.insert(schema.agentSkills).values({
    id: skillId,
    institutionId,
    skillKey: `assistance-ob1-lot5-${marker}`,
    name: skillName,
    domain: "Vie scolaire",
    enabled: true,
    activeVersionId: null,
  });
  await db.insert(schema.agentSkillVersions).values({
    id: versionId,
    institutionId,
    skillId,
    version: "1.0.0",
    status: "published",
    definition: { instructions: instructionsText, allowedTools: [] },
    contentHash: createHash("sha256").update(`fictif-content-hash-${marker}`).digest("hex"),
    dataClassification: "public",
    createdBy: knowledgeManager.id,
    approvedBy: knowledgeManager.id,
    publishedAt: new Date(Date.now() - 3_600_000),
    reviewDueAt: new Date(futureIso(24 * 30)),
  });
  await db.update(schema.agentSkills).set({ activeVersionId: versionId }).where(eq(schema.agentSkills.id, skillId));
  await db.insert(schema.skillSourceLinks).values({ institutionId, skillVersionId: versionId, sourceId, required: true });

  const query = `Question fictive OB1 LOT5 ${marker}`;
  const beforeCorrection = await loadPublicKnowledgeContext({ query, now: new Date() });
  check(beforeCorrection.instructions.includes(skillName), true, "before_correction_skill_reaches_agent");

  // === Scénario 6 : correction RÉELLE de l'actualité -> révocation
  // immédiate de la source dérivée, disparition réelle du contexte. ===
  const correction = await call(correctionHandler, {
    headers: authHeaders(flashValidator.token),
    query: { id: flashInfoId },
    body: {
      title: `Actualité fictive OB1 LOT5 ${marker} — corrigée`,
      bodyMarkdown: `Contenu corrigé ${marker}.`,
      importance: "normale",
      channels: [],
      groupRefs: ["public:site"],
      expiresAt: futureIso(72),
    },
  });
  check(correction.status, 200, "flash_correction_status");
  check(correction.body.version.status, "modifiee", "flash_correction_status_field");

  const [sourceAfterCorrection] = await db
    .select({ status: schema.knowledgeSources.status })
    .from(schema.knowledgeSources)
    .where(eq(schema.knowledgeSources.id, sourceId))
    .limit(1);
  check(sourceAfterCorrection.status, "revoked", "source_revoked_immediately_after_correction");

  const afterCorrection = await loadPublicKnowledgeContext({ query, now: new Date() });
  check(afterCorrection.instructions.includes(skillName), false, "after_correction_skill_no_longer_reaches_agent");

  // === Scénario 7 : une proposition « issue d'une discussion » contenant un
  // email est expurgée et ne peut jamais être approuvée. ===
  const conversationId = randomUUID();
  const withEmail = await call(conversationProposalHandler, {
    headers: authHeaders(knowledgeManagerAal2Token),
    body: {
      conversationId,
      title: `Observation fictive de conversation ${marker}`,
      candidateText: `Un usager a laissé son adresse ob1-lot5-${marker}@example.test pendant l'échange.`,
      classification: "internal",
      serviceCodes: ["vie_scolaire"],
      validFrom: new Date().toISOString(),
      expiresAt: futureIso(24 * 30),
      provenanceStatus: "observed",
      usePolicy: "do_not_inject_automatically",
    },
  });
  check(withEmail.status, 200, "conversation_proposal_with_email_created");
  check(withEmail.body.proposal.privacySignalCount, 1, "conversation_proposal_email_signal_detected");
  check(withEmail.body.proposal.proposedText, null, "conversation_proposal_text_removed");
  const emailProposalId = withEmail.body.proposal.id;

  const rejectApprovalOfScrubbedProposal = await call(proposalDecisionHandler, {
    headers: authHeaders(knowledgeManagerAal2Token),
    query: { id: emailProposalId },
    body: { action: "approve", note: "Tentative d'approbation d'une proposition expurgée, doit échouer." },
  });
  check(rejectApprovalOfScrubbedProposal.status, 409, "scrubbed_proposal_cannot_be_approved");

  const rejectScrubbedProposal = await call(proposalDecisionHandler, {
    headers: authHeaders(knowledgeManagerAal2Token),
    query: { id: emailProposalId },
    body: { action: "reject", note: "Donnée personnelle détectée, à ressaisir sans email." },
  });
  check(rejectScrubbedProposal.status, 200, "scrubbed_proposal_can_be_rejected");
  check(rejectScrubbedProposal.body.status, "rejected", "scrubbed_proposal_rejected_status");

  // === Scénario 8 : les contraintes de la migration rejettent les
  // combinaisons interdites (preuve en base, pas seulement code). ===
  const rejectedCombinations = [];
  const tryInsert = async (label, valuesSql) => {
    try {
      await db.execute(valuesSql);
      rejectedCombinations.push({ label, rejected: false });
    } catch {
      rejectedCombinations.push({ label, rejected: true });
    }
  };
  await tryInsert(
    "generated_provenance_with_instruction_policy",
    sql`insert into public.knowledge_source_proposals
      (institution_id, origin, origin_conversation_id, title, proposed_text, classification, valid_from, provenance_status, use_policy, proposed_by)
      values (${institutionId}::uuid, 'conversation', ${randomUUID()}::uuid, 'Titre fictif rejet', 'Texte fictif suffisamment long pour la contrainte de longueur.', 'internal', now(), 'generated', 'can_use_as_instruction', ${knowledgeManager.id}::uuid)`
  );
  await tryInsert(
    "mixed_origin_references",
    sql`insert into public.knowledge_source_proposals
      (institution_id, origin, origin_conversation_id, origin_flash_info_id, origin_flash_version_id, title, proposed_text, classification, valid_from, provenance_status, use_policy, proposed_by)
      values (${institutionId}::uuid, 'conversation', ${randomUUID()}::uuid, ${flashInfoId}::uuid, ${versionId}::uuid, 'Titre fictif rejet', 'Texte fictif suffisamment long pour la contrainte de longueur.', 'internal', now(), 'observed', 'can_use_as_evidence', ${knowledgeManager.id}::uuid)`
  );
  await tryInsert(
    "approved_status_without_source",
    sql`insert into public.knowledge_source_proposals
      (institution_id, origin, origin_conversation_id, title, proposed_text, classification, valid_from, provenance_status, use_policy, proposed_by, status, reviewed_by, reviewed_at, review_note)
      values (${institutionId}::uuid, 'conversation', ${randomUUID()}::uuid, 'Titre fictif rejet', 'Texte fictif suffisamment long pour la contrainte de longueur.', 'internal', now(), 'observed', 'can_use_as_evidence', ${knowledgeManager.id}::uuid, 'approved', ${knowledgeManager.id}::uuid, now(), 'Note fictive suffisamment longue.')`
  );
  check(rejectedCombinations.every((entry) => entry.rejected), true, "all_forbidden_combinations_rejected_by_db");

  console.log(
    JSON.stringify(
      {
        target: "127.0.0.1:54322",
        assertions,
        rejectedCombinations,
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
