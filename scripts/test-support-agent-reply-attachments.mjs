import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const files = {
  migration: "supabase/migrations/20260830170000_add_agent_reply_attachments.sql",
  removalMigration: "supabase/migrations/20260830180000_allow_agent_attachment_removal_pending.sql",
  reserve: "api/support/agent/requests/[code]/attachments.ts",
  confirm: "api/support/agent/attachments/[id]/confirm.ts",
  agentAttachment: "api/support/agent/attachments/[id].ts",
  reply: "api/support/agent/requests/[code]/reply.ts",
  publicDetail: "api/support/requests/[code].ts",
  publicDownload: "api/support/attachments/[id].ts",
  page: "src/pages/prototype/LyceeConnectPrototype.tsx",
  emailWorker: "workers/support-email-worker.mjs",
  cronWorker: "api/cron/support-worker.ts",
};

const source = Object.fromEntries(
  await Promise.all(Object.entries(files).map(async ([key, path]) => [key, await readFile(path, "utf8")]))
);

test("la base distingue les pièces agent et impose une publication atomique", () => {
  assert.match(source.migration, /direction in \('requester', 'agent'\)/);
  assert.match(source.migration, /direction = 'agent'[\s\S]*uploaded_by_user is not null/);
  assert.match(source.migration, /released_at is not null[\s\S]*released_by is not null[\s\S]*message_id is not null/);
  assert.match(source.migration, /direction = 'requester'[\s\S]*released_at is null/);
});

test("la réservation agent reste privée, bornée et limitée au service autorisé", () => {
  assert.match(source.reserve, /requireSupportAgent\(req\)/);
  assert.match(source.reserve, /assertSupportRequestAccess\(access, request\.assignedTeam\)/);
  assert.match(source.reserve, /enforceAgentWriteRateLimit\(user\.id\)/);
  assert.match(source.reserve, /MAX_FILE_BYTES = 10 \* 1024 \* 1024/);
  assert.match(source.reserve, /MAX_AGENT_PENDING_FILES = 5/);
  assert.match(source.reserve, /createSignedUploadUrl\(storagePath\)/);
  assert.match(source.reserve, /direction: "agent"/);
  assert.match(source.reserve, /uploadedByUser: user\.id/);
  assert.doesNotMatch(source.reserve, /getPublicUrl|publicUrl/);
});

test("la confirmation agent lie le fichier au compte et réutilise l’antivirus", () => {
  assert.match(source.confirm, /requireSupportAgent\(req\)/);
  assert.match(source.confirm, /eq\(supportAttachments\.uploadedByUser, user\.id\)/);
  assert.match(source.confirm, /eq\(supportAttachments\.direction, "agent"\)/);
  assert.match(source.confirm, /readBoundedBlobBytes\(file, Number\(attachment\.sizeBytes\), MAX_FILE_BYTES\)/);
  assert.match(source.confirm, /'support_file_scan'/);
  assert.match(source.confirm, /actorType: "agent"/);
});

test("la réponse ne libère que les fichiers propres et refuse les dossiers sensibles non vérifiés", () => {
  assert.match(source.reply, /rawAttachmentIds\.length > 5/);
  assert.match(source.reply, /new Set\(attachmentIds\)\.size !== attachmentIds\.length/);
  assert.match(source.reply, /Aucun document ne peut être transmis avant la confirmation d’identité/);
  assert.match(source.reply, /eq\(supportAttachments\.scanStatus, "clean"\)/);
  assert.match(source.reply, /isNull\(supportAttachments\.messageId\)/);
  assert.match(source.reply, /isNull\(supportAttachments\.releasedAt\)/);
  assert.match(source.reply, /messageId: created\.id[\s\S]*releasedAt: new Date\(\)[\s\S]*releasedBy: user\.id/);
  assert.match(source.reply, /releasedAttachments\.length !== attachmentIds\.length/);
});

test("un agent retire uniquement son propre brouillon terminal sans course avec l’envoi", () => {
  assert.match(source.removalMigration, /support_attachments_scan_status_check/);
  assert.match(source.removalMigration, /'removal_pending'/);
  assert.match(source.agentAttachment, /methodNotAllowed\(res, \["GET", "DELETE"\]\)/);
  assert.match(source.agentAttachment, /requireSupportAgent\(req\)/);
  assert.match(source.agentAttachment, /enforceAgentWriteRateLimit\(user\.id\)/);
  assert.match(source.agentAttachment, /lockedCandidate\.direction !== "agent" \|\| lockedCandidate\.uploadedByUser !== user\.id/);
  assert.match(source.agentAttachment, /REMOVABLE_DRAFT_STATUSES = \["clean", "blocked", "scan_error"\]/);
  assert.match(source.agentAttachment, /isNull\(supportAttachments\.messageId\)/);
  assert.match(source.agentAttachment, /isNull\(supportAttachments\.releasedAt\)/);
  assert.match(source.agentAttachment, /pg_advisory_xact_lock\(hashtextextended\(\$\{candidate\.requestId\}::text, 0\)\)/);
  assert.match(source.reply, /pg_advisory_xact_lock\(hashtextextended\(\$\{request\.id\}::text, 0\)\)/);
  assert.match(source.agentAttachment, /const \[lockedCandidate\][\s\S]*lockedCandidate\.messageId \|\| lockedCandidate\.releasedAt/);
  assert.match(source.agentAttachment, /scanStatus: "removal_pending"/);
  assert.match(source.agentAttachment, /eventType: "attachment\.draft_removal_requested"/);
  assert.match(source.agentAttachment, /\.remove\(\[prepared\.storagePath\]\)/);
  assert.match(source.agentAttachment, /scanDetail: "storage_removal_failed"/);
  assert.match(source.agentAttachment, /eventType: "attachment\.draft_removal_failed"/);
  assert.match(source.agentAttachment, /\.delete\(supportAttachments\)/);
  assert.match(source.agentAttachment, /eq\(supportAttachments\.scanStatus, "removal_pending"\)/);
  assert.match(source.agentAttachment, /eventType: "attachment\.draft_removed"/);
  assert.doesNotMatch(source.agentAttachment, /fromValue: \{[^}]*originalName/);
  assert.match(source.agentAttachment, /bodyParser: false/);
});

test("le demandeur ne voit et ne télécharge jamais un brouillon agent", () => {
  for (const text of [source.publicDetail, source.publicDownload]) {
    assert.match(text, /eq\(supportAttachments\.direction, "agent"\)/);
    assert.match(text, /isNotNull\(supportAttachments\.messageId\)/);
    assert.match(text, /isNotNull\(supportAttachments\.releasedAt\)/);
  }
  assert.match(source.publicDownload, /requireSupportAccess\(req, code\)/);
  assert.match(source.publicDownload, /eq\(supportAttachments\.requestId, access\.requestId\)/);
  assert.match(source.publicDownload, /attachment\.scanStatus !== "clean"/);
  assert.match(source.publicDownload, /createSignedUrl\(attachment\.storagePath, 60/);
});

test("l’interface valide les réponses API et n’attache pas les binaires aux emails", () => {
  assert.match(source.page, /uploadAgentSupportFile/);
  assert.match(source.page, /isSupportUploadReservationPayload\(reservation\)/);
  assert.match(source.page, /isSupportAttachmentConfirmationPayload\(confirmation/);
  assert.match(source.page, /attachmentIds: selectedAgentAttachmentIds/);
  assert.match(source.page, /Documents à joindre à la réponse/);
  assert.match(source.page, /canRemoveDraft/);
  assert.match(source.page, /Retrait à reprendre/);
  assert.match(source.page, /removeAgentAttachment/);
  assert.match(source.page, /method: "DELETE"/);
  assert.match(source.page, /verifySupportAttachmentRemovalConfirmation/);
  for (const worker of [source.emailWorker, source.cronWorker]) {
    assert.match(worker, /dans votre suivi sécurisé/);
    assert.doesNotMatch(worker, /attachment:\s*\[/);
  }
});
