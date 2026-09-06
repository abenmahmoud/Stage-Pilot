// Hard-coded disposable loopback target; never inherits DATABASE_URL or loads .env.
// LOT 6 du plan de connaissance OB1 (2026-09-05) — recette sur PostgreSQL
// réel jetable de `runKnowledgeFreshnessSweep`
// (api/_shared/knowledge-freshness-sweep.ts), rejouée directement à la
// fonction (pas via HTTP : c'est la même fonction, sans duplication, que
// celle appelée par `api/cron/knowledge-expiry.ts` ET par les trois routes
// de publication — la preuve de wiring statique vit dans
// scripts/test-knowledge-freshness-schedule.mjs). Établissement, compétences
// et sources entièrement fictifs.
import assert from "node:assert/strict";
import { randomUUID, createHash } from "node:crypto";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { sql, eq } from "drizzle-orm";
import {
  institutions,
  agentSkills,
  agentSkillVersions,
  knowledgeSources,
  skillSourceLinks,
  agentSkillAudit,
} from "../db/schema.ts";
import { runKnowledgeFreshnessSweep } from "../api/_shared/knowledge-freshness-sweep.ts";

if (process.argv.length !== 3 || process.argv[2] !== "--local-stack-only") {
  throw new Error("local_stack_confirmation_required");
}

const client = postgres({
  host: "127.0.0.1",
  port: 54322,
  database: "postgres",
  user: "postgres",
  password: "postgres",
  max: 1,
  prepare: false,
  connect_timeout: 5,
});
const database = drizzle(client, {
  schema: { institutions, agentSkills, agentSkillVersions, knowledgeSources, skillSourceLinks, agentSkillAudit },
});
let assertions = 0;
const check = (actual, expected, message) => {
  assert.deepEqual(actual, expected, message);
  assertions++;
};
const fixtureHash = (label) => createHash("sha256").update(label, "utf8").digest("hex");

const rollback = new Error("intentional_fixture_rollback");
const institutionId = randomUUID();
const ownerUserId = randomUUID();
// `agent_skill_versions` exige `review_due_at > created_at` (created_at étant
// l'horloge réelle de Postgres au moment de l'insertion) : les échéances sont
// donc calées sur l'horloge réelle de ce script, pas sur une date fictive
// fixe, pour rester valides quel que soit le jour où cette recette est
// rejouée.
const testStart = Date.now();
const now = new Date(testStart + 60 * 60 * 1000); // "maintenant" du balayage : 1h après le début du script
const notYetDueReviewAt = new Date(testStart + 365 * 24 * 60 * 60 * 1000); // dans un an : jamais en retard
const overdueReviewAt = new Date(testStart + 5 * 60 * 1000); // dans 5 min : en retard par rapport à `now` (+1h)

try {
  await database.transaction(async (tx) => {
    await tx.execute(sql`
      insert into auth.users
        (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
      values (
        ${ownerUserId}::uuid, '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated',
        ${`lot6-fixture-${ownerUserId}@example.test`}, '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()
      )
    `);
    await tx.execute(sql`
      insert into public.institutions (id, slug, name, status)
      values (${institutionId}, ${`fraicheur-fictif-${institutionId}`}, 'Fraîcheur fictive LOT 6', 'draft')
    `);

    // ------------------------------------------------------------------
    // Scénario A (bullet 3, "publication") : une source publiée déjà
    // périmée, requise par une compétence active, doit être désactivée dès
    // qu'un balayage `trigger: "publication"` tourne — exactement ce que
    // les routes de publication déclenchent désormais immédiatement après
    // avoir publié autre chose, sans attendre le prochain créneau planifié.
    // ------------------------------------------------------------------
    const [expiredSource] = await tx
      .insert(knowledgeSources)
      .values({
        institutionId,
        title: "Source fictive déjà périmée",
        sourceType: "official_url",
        uri: "internal://lot6-fixture/expired-source",
        classification: "internal",
        ownerUserId,
        validFrom: new Date("2026-01-01T00:00:00.000Z"),
        expiresAt: new Date("2026-09-01T00:00:00.000Z"), // avant `now`
        status: "published",
        checksum: fixtureHash("lot6-fixture-expired-source"),
      })
      .returning();

    const [skill] = await tx
      .insert(agentSkills)
      .values({
        institutionId,
        skillKey: "lot6-fixture-skill-publication",
        name: "Compétence fictive LOT 6 (publication)",
        domain: "test",
        enabled: true,
      })
      .returning();

    const [version] = await tx
      .insert(agentSkillVersions)
      .values({
        institutionId,
        skillId: skill.id,
        version: "1.0.0",
        status: "published",
        contentHash: fixtureHash("lot6-fixture-version-publication"),
        createdBy: ownerUserId,
        approvedBy: ownerUserId,
        publishedAt: new Date(),
        reviewDueAt: notYetDueReviewAt, // pas en retard : seule la source doit déclencher
      })
      .returning();

    await tx.update(agentSkills).set({ activeVersionId: version.id }).where(eq(agentSkills.id, skill.id));

    await tx.insert(skillSourceLinks).values({
      institutionId,
      skillVersionId: version.id,
      sourceId: expiredSource.id,
      required: true,
    });

    const publicationResult = await runKnowledgeFreshnessSweep(tx, now, "publication");
    check(publicationResult.expiredSources, 1, "publication_trigger_expires_the_overdue_source");
    check(publicationResult.disabledSkills, 1, "publication_trigger_disables_the_dependent_skill");

    const [sourceAfter] = await tx
      .select({ status: knowledgeSources.status })
      .from(knowledgeSources)
      .where(eq(knowledgeSources.id, expiredSource.id));
    check(sourceAfter.status, "expired", "source_status_updated_to_expired");

    const [skillAfter] = await tx
      .select({ enabled: agentSkills.enabled, activeVersionId: agentSkills.activeVersionId })
      .from(agentSkills)
      .where(eq(agentSkills.id, skill.id));
    check(skillAfter.enabled, false, "dependent_skill_disabled");
    check(skillAfter.activeVersionId, null, "dependent_skill_loses_its_active_version");

    const auditRows = await tx
      .select({ action: agentSkillAudit.action, summary: agentSkillAudit.summary })
      .from(agentSkillAudit)
      .where(eq(agentSkillAudit.resourceId, skill.id));
    check(auditRows.length, 1, "exactly_one_audit_row_for_the_disabled_skill");
    check(auditRows[0].action, "disable_automatic", "audit_action_is_disable_automatic");
    check(auditRows[0].summary.trigger, "publication", "audit_trigger_records_publication_not_schedule");

    // ------------------------------------------------------------------
    // Scénario B : la même fonction, rejouée avec
    // `trigger: "scheduled_freshness_check"` (8 h/13 h/18 h Paris), désactive
    // une compétence pour une revue en retard — même code, motif d'audit
    // distinct, preuve que les deux déclencheurs ne sont jamais confondus.
    // ------------------------------------------------------------------
    const [overdueSkill] = await tx
      .insert(agentSkills)
      .values({
        institutionId,
        skillKey: "lot6-fixture-skill-freshness",
        name: "Compétence fictive LOT 6 (fraîcheur)",
        domain: "test",
        enabled: true,
      })
      .returning();
    const [overdueVersion] = await tx
      .insert(agentSkillVersions)
      .values({
        institutionId,
        skillId: overdueSkill.id,
        version: "1.0.0",
        status: "published",
        contentHash: fixtureHash("lot6-fixture-version-freshness"),
        createdBy: ownerUserId,
        approvedBy: ownerUserId,
        publishedAt: new Date(),
        reviewDueAt: overdueReviewAt, // en retard sur `now` (+1h)
      })
      .returning();
    await tx
      .update(agentSkills)
      .set({ activeVersionId: overdueVersion.id })
      .where(eq(agentSkills.id, overdueSkill.id));

    const freshnessResult = await runKnowledgeFreshnessSweep(tx, now, "scheduled_freshness_check");
    check(freshnessResult.disabledSkills, 1, "freshness_check_disables_the_overdue_skill");

    const overdueAuditRows = await tx
      .select({ summary: agentSkillAudit.summary })
      .from(agentSkillAudit)
      .where(eq(agentSkillAudit.resourceId, overdueSkill.id));
    check(overdueAuditRows.length, 1, "exactly_one_audit_row_for_the_overdue_skill");
    check(
      overdueAuditRows[0].summary.trigger,
      "scheduled_freshness_check",
      "audit_trigger_records_the_freshness_check_not_publication"
    );
    check(
      overdueAuditRows[0].summary.reasons,
      ["review_overdue"],
      "reason_is_review_overdue_not_source_expired"
    );

    throw rollback;
  });
} catch (error) {
  if (error !== rollback) throw error;
} finally {
  await client.end();
}

const verifier = postgres({
  host: "127.0.0.1",
  port: 54322,
  database: "postgres",
  user: "postgres",
  password: "postgres",
  max: 1,
  prepare: false,
  connect_timeout: 5,
});
const [{ count: leftoverCount }] = await verifier`
  select count(*)::int as count from public.institutions where id = ${institutionId}
`;
await verifier.end();

console.log(
  JSON.stringify({
    target: "127.0.0.1:54322",
    assertions,
    rollbackVerified: leftoverCount === 0,
  })
);
