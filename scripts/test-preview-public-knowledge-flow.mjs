import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import postgres from "postgres";

const EXPECTED_PROJECT_REF = "xijocumlwivhbmffrnlj";
const databaseUrl = process.env.DATABASE_URL;
if (!process.argv.includes("--preview-only")) {
  throw new Error("Use --preview-only to confirm the isolated preview recipe");
}
if (!databaseUrl || !databaseUrl.includes(EXPECTED_PROJECT_REF)) {
  throw new Error("DATABASE_URL does not match the expected Supabase preview branch");
}

const sql = postgres(databaseUrl, { prepare: false, max: 2, idle_timeout: 5 });
const runId = randomUUID();
const marker = runId.replaceAll("-", "").slice(0, 10);
const ids = {
  source: randomUUID(),
  document: randomUUID(),
  skill: randomUUID(),
  version: randomUUID(),
};
const title = `[TEST] Recette publique ${marker}`;
const query = `Je suis élève fictif et la procédure alpha ${marker} pour mon accès ENT est bloquée depuis hier.`;
const excerpt = `Procédure alpha ${marker} entièrement fictive : pour un accès ENT bloqué, vérifier l'adresse du portail puis transmettre la demande au référent numérique. Ne jamais demander ni communiquer de mot de passe.`;
const hash = (value) => createHash("sha256").update(value).digest("hex");

async function previewContext() {
  const [row] = await sql`
    select i.id as institution_id, m.user_id
    from public.institutions i
    join public.institution_memberships m on m.institution_id = i.id
    where i.slug = 'blaise-cendrars-sevran'
      and m.status = 'active'
      and m.role = 'admin'
    order by m.created_at
    limit 1
  `;
  if (!row) throw new Error("No active preview administrator found");
  return row;
}

async function assertNoStaleRecipe() {
  const [row] = await sql`
    select count(*)::int as count
    from public.knowledge_sources
    where title like '[TEST] Recette publique %'
  `;
  assert.equal(row.count, 0, "A previous public knowledge recipe was not cleaned up");
}

async function seedFictionalRecipe(context) {
  await sql.begin(async (tx) => {
    await tx`
      insert into public.knowledge_sources (
        id, institution_id, title, source_type, uri, classification,
        owner_user_id, service_codes, valid_from, expires_at, status, checksum
      ) values (
        ${ids.source}, ${context.institution_id}, ${title}, 'procedure',
        ${`urn:lyceegest:preview:test:${runId}`}, 'public', ${context.user_id},
        array[]::text[], now() - interval '1 minute', now() + interval '7 days',
        'published', ${hash(excerpt)}
      )
    `;
    await tx`
      insert into public.knowledge_documents (
        id, institution_id, source_id, title, purpose_description, source_type,
        classification, owner_service_code, service_codes, valid_from,
        review_due_at, original_name, mime_type, size_bytes, storage_bucket,
        storage_path, status, checksum, analysis_summary, proposed_knowledge,
        uploaded_by, reviewed_by, uploaded_at, analyzed_at, reviewed_at
      ) values (
        ${ids.document}, ${context.institution_id}, ${ids.source}, ${title},
        'Recette automatisée avec une procédure entièrement fictive sur la preview uniquement.',
        'procedure', 'public', 'referent_numerique', array[]::text[], current_date,
        now() + interval '7 days', ${`procedure-${marker}.txt`}, 'text/plain',
        ${Buffer.byteLength(excerpt)}, 'knowledge-ingest',
        ${`${context.institution_id}/recipe-test/${runId}.txt`}, 'ready',
        ${hash(excerpt)}, 'Document fictif validé pour une recette automatisée.',
        ${tx.json({ state: "compiled", excerptCount: 1, fictional: true })},
        ${context.user_id}, ${context.user_id}, now(), now(), now()
      )
    `;
    await tx`
      insert into public.knowledge_source_excerpts (
        institution_id, source_id, document_id, ordinal, excerpt_text, content_hash
      ) values (
        ${context.institution_id}, ${ids.source}, ${ids.document}, 0,
        ${excerpt}, ${hash(excerpt)}
      )
    `;
    await tx`
      insert into public.agent_skills (
        id, institution_id, skill_key, name, domain, enabled
      ) values (
        ${ids.skill}, ${context.institution_id}, ${`test-ent-${marker}`},
        ${`Assistance ENT fictive ${marker}`}, 'Accès numérique', false
      )
    `;
    await tx`
      insert into public.agent_skill_versions (
        id, institution_id, skill_id, version, status, definition, content_hash,
        data_classification, created_by, approved_by, published_at, review_due_at
      ) values (
        ${ids.version}, ${context.institution_id}, ${ids.skill}, '1.0.0',
        'published', ${tx.json({
          instructions: `Appliquer uniquement la procédure alpha ${marker} validée pour les demandes ENT fictives.`,
          allowedTools: ["knowledge.search_published"],
        })}, ${hash(`skill-${marker}`)}, 'public', ${context.user_id},
        ${context.user_id}, now(), now() + interval '7 days'
      )
    `;
    await tx`
      insert into public.skill_source_links (
        institution_id, skill_version_id, source_id, required
      ) values (${context.institution_id}, ${ids.version}, ${ids.source}, true)
    `;
    await tx`
      insert into public.agent_evaluations (
        institution_id, skill_version_id, test_case_key, kind, result, scores, evidence
      ) values (
        ${context.institution_id}, ${ids.version}, ${`test-${marker}`}, 'positive',
        'pass', ${tx.json({ fictional: true, boundedContext: true })},
        ${tx.json({ recipe: "preview-public-knowledge-flow" })}
      )
    `;
    await tx`
      update public.agent_skills
      set active_version_id = ${ids.version}, enabled = true
      where id = ${ids.skill} and institution_id = ${context.institution_id}
    `;
  });
}

async function exerciseAgent(context) {
  const { loadPublicKnowledgeContext, recordPublicKnowledgeUsage } = await import(
    "../api/_shared/public-knowledge-context.ts"
  );
  const { analyzeSupportConversation } = await import("../api/_shared/support-agent.ts");
  const loaded = await loadPublicKnowledgeContext({ query });
  assert.equal(loaded.versions.some((item) => item.versionId === ids.version), true);
  assert.equal(loaded.sources.some((item) => item.sourceId === ids.source), true);
  assert.match(loaded.instructions, new RegExp(marker));
  assert.match(loaded.instructions, /Ne jamais demander ni communiquer de mot de passe/i);
  assert.doesNotMatch(loaded.instructions, /urn:lyceegest|checksum|recipe-test/i);

  const originalFetch = globalThis.fetch;
  const originalApiKey = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = "preview-recipe-mock-key";
  let modelInstructions = "";
  globalThis.fetch = async (_url, init) => {
    const body = JSON.parse(init.body);
    modelInstructions = body.instructions;
    return new Response(JSON.stringify({
      output: [{
        type: "message",
        content: [{
          type: "output_text",
          text: JSON.stringify({
            reply: `La procédure alpha ${marker} indique de vérifier l'adresse du portail, puis de transmettre la demande au référent numérique sans communiquer de mot de passe.`,
            category: "ent",
            requesterType: "eleve",
            urgency: "normale",
            confidence: "high",
            missingInformation: [],
            suggestedDocuments: [],
            readyToCreate: true,
            safetyNotice: "Ne communiquez jamais votre mot de passe.",
            detectedLanguage: "français",
            internalSummaryFr: "L'élève signale un blocage ENT et demande la procédure validée du lycée.",
          }),
        }],
      }],
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  };

  try {
    const result = await analyzeSupportConversation({
      messages: [
        { role: "assistant", content: "Bonjour, comment puis-je vous aider ?" },
        { role: "requester", content: query },
      ],
      attachments: [],
      safetyIdentifier: `preview-recipe-${marker}`,
      knowledgeContextLoader: async () => loaded,
      knowledgeUsageRecorder: recordPublicKnowledgeUsage,
    });
    assert.equal(result.usedAi, true);
    assert.equal(result.category, "ent");
    assert.match(result.reply, new RegExp(marker));
    assert.match(modelInstructions, new RegExp(marker));
  } finally {
    globalThis.fetch = originalFetch;
    process.env.OPENAI_API_KEY = originalApiKey;
  }

  const audits = await sql`
    select resource_type, resource_id, action, actor_id, summary
    from public.agent_skill_audit
    where action = 'consult_public'
      and resource_id = any(${[ids.version, ids.source]}::uuid[])
    order by resource_type
  `;
  assert.equal(audits.length, 2, "The successful answer did not audit source and version usage");
  assert.deepEqual(audits.map((row) => row.resource_type), ["source", "version"]);
  for (const audit of audits) {
    assert.equal(audit.actor_id, null);
    assert.deepEqual(Object.keys(audit.summary).sort(), ["channel", "model", "sessionHash", "turnCount"]);
    assert.doesNotMatch(JSON.stringify(audit.summary), /élève|adresse|mot de passe|@/i);
  }
  return { loaded, audits };
}

async function cleanup() {
  await sql.begin(async (tx) => {
    await tx`
      update public.agent_skills
      set enabled = false, active_version_id = null
      where id = ${ids.skill}
    `;
    await tx`
      delete from public.agent_skill_audit
      where resource_id = any(${Object.values(ids)}::uuid[])
    `;
    await tx`delete from public.agent_evaluations where skill_version_id = ${ids.version}`;
    await tx`delete from public.skill_source_links where skill_version_id = ${ids.version}`;
    await tx`delete from public.knowledge_source_excerpts where source_id = ${ids.source}`;
    await tx`delete from public.knowledge_documents where id = ${ids.document}`;
    await tx`delete from public.agent_skill_versions where id = ${ids.version}`;
    await tx`delete from public.agent_skills where id = ${ids.skill}`;
    await tx`delete from public.knowledge_sources where id = ${ids.source}`;
  });
}

async function verifyCleanup() {
  const [counts] = await sql`
    select
      (select count(*)::int from public.knowledge_sources where id = ${ids.source}) as sources,
      (select count(*)::int from public.knowledge_documents where id = ${ids.document}) as documents,
      (select count(*)::int from public.knowledge_source_excerpts where source_id = ${ids.source}) as excerpts,
      (select count(*)::int from public.agent_skills where id = ${ids.skill}) as skills,
      (select count(*)::int from public.agent_skill_versions where id = ${ids.version}) as versions,
      (select count(*)::int from public.agent_skill_audit
        where resource_id = any(${Object.values(ids)}::uuid[])) as audits
  `;
  assert.deepEqual(counts, {
    sources: 0,
    documents: 0,
    excerpts: 0,
    skills: 0,
    versions: 0,
    audits: 0,
  });
  return counts;
}

let result;
try {
  await assertNoStaleRecipe();
  const context = await previewContext();
  await seedFictionalRecipe(context);
  result = await exerciseAgent(context);
  console.log(JSON.stringify({
    target: "supabase-preview",
    fictional: true,
    sourceSelected: result.loaded.sources.length > 0,
    skillSelected: result.loaded.versions.length > 0,
    boundedContext: result.loaded.instructions.length <= 10_000,
    response: "verified-with-mocked-model",
    usageAudits: result.audits.length,
  }));
} finally {
  await cleanup();
  const cleaned = await verifyCleanup();
  console.log(JSON.stringify({ cleanup: cleaned }));
  await sql.end({ timeout: 5 });
}
