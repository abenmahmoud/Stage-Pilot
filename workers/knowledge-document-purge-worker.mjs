import { createClient } from "@supabase/supabase-js";
import postgres from "postgres";
import WebSocket from "ws";
import {
  boundedPurgeError,
  isKnowledgeDocumentPurgeEligible,
  purgedKnowledgeDocumentValues,
} from "./knowledge-document-retention-policy.mjs";

const databaseUrl = process.env.DATABASE_URL;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const purgeEnabled = process.env.KNOWLEDGE_PURGE_WORKER_ENABLED === "true";
if (!databaseUrl || !supabaseUrl || !serviceRoleKey) {
  throw new Error("DATABASE_URL, SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
}
if (!purgeEnabled) {
  throw new Error("KNOWLEDGE_PURGE_WORKER_ENABLED must be true");
}

const sql = postgres(databaseUrl, { prepare: false, max: 2, idle_timeout: 20 });
const storage = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
  realtime: { transport: WebSocket },
}).storage;

async function claimDueDocuments(limit = 20) {
  return sql.begin(async (tx) => tx`
    with candidates as (
      select id
      from public.knowledge_documents
      where retention_policy_key = 'approved'
        and retention_until <= now()
        and purge_status in ('scheduled', 'failed')
        and source_id is null
        and status in ('reserved', 'uploaded', 'review', 'rejected', 'failed')
      order by retention_until, created_at
      limit ${limit}
      for update skip locked
    )
    update public.knowledge_documents as document
    set purge_status = 'processing',
        purge_started_at = now(),
        last_purge_error = null
    from candidates
    where document.id = candidates.id
    returning document.*
  `);
}

async function markFailure(document, error) {
  const code = boundedPurgeError(error);
  await sql.begin(async (tx) => {
    const updated = await tx`
      update public.knowledge_documents
      set purge_status = 'failed', last_purge_error = ${code}
      where id = ${document.id}
        and institution_id = ${document.institution_id}
        and purge_status = 'processing'
      returning id
    `;
    if (updated.length !== 1) return;
    await tx`
      insert into public.agent_skill_audit (
        institution_id, resource_type, resource_id, action, actor_id, summary
      ) values (
        ${document.institution_id}, 'document', ${document.id},
        'fail_purge', null, ${tx.json({ reason: code })}
      )
    `;
  });
}

async function purgeDocument(document) {
  if (!isKnowledgeDocumentPurgeEligible({ ...document, purge_status: "scheduled" })) {
    await markFailure(document, new Error("document_not_eligible"));
    return "skipped";
  }
  const { error } = await storage.from(document.storage_bucket).remove([document.storage_path]);
  if (error) {
    await markFailure(document, new Error("storage_remove_failed"));
    return "failed";
  }

  const values = purgedKnowledgeDocumentValues(document.id);
  await sql.begin(async (tx) => {
    await tx`
      delete from public.knowledge_source_excerpts
      where document_id = ${document.id}
        and institution_id = ${document.institution_id}
    `;
    const updated = await tx`
      update public.knowledge_documents
      set title = ${values.title},
          purpose_description = ${values.purposeDescription},
          original_name = ${values.originalName},
          mime_type = ${values.mimeType},
          size_bytes = ${values.sizeBytes},
          storage_path = ${values.storagePath},
          status = ${values.status},
          checksum = null,
          analysis_summary = ${values.analysisSummary},
          proposed_knowledge = '{}'::jsonb,
          analysis_error = null,
          purge_status = ${values.purgeStatus},
          purged_at = ${values.purgedAt},
          last_purge_error = null
      where id = ${document.id}
        and institution_id = ${document.institution_id}
        and purge_status = 'processing'
        and source_id is null
      returning id
    `;
    if (updated.length !== 1) throw new Error("purge_state_changed");
    await tx`
      insert into public.agent_skill_audit (
        institution_id, resource_type, resource_id, action, actor_id, summary
      ) values (
        ${document.institution_id}, 'document', ${document.id},
        'purge_document', null,
        ${tx.json({ reason: "approved_retention_expired", storageRemoved: true })}
      )
    `;
  });
  return "purged";
}

async function main() {
  const documents = await claimDueDocuments();
  const outcomes = [];
  for (const document of documents) {
    try {
      outcomes.push(await purgeDocument(document));
    } catch (error) {
      await markFailure(document, error);
      outcomes.push("failed");
    }
  }
  console.log(JSON.stringify({ claimed: documents.length, outcomes }));
  await sql.end();
}

main().catch(async (error) => {
  console.error(boundedPurgeError(error));
  await sql.end({ timeout: 1 });
  process.exitCode = 1;
});
