const PURGEABLE_STATUSES = new Set(["reserved", "uploaded", "review", "rejected", "failed"]);

export function isKnowledgeDocumentPurgeEligible(document, now = new Date()) {
  if (!document || document.retention_policy_key !== "approved") return false;
  if (document.source_id || !PURGEABLE_STATUSES.has(document.status)) return false;
  if (!["scheduled", "failed"].includes(document.purge_status)) return false;
  const retentionUntil = new Date(document.retention_until ?? "invalid");
  return Number.isFinite(retentionUntil.getTime()) && retentionUntil.getTime() <= now.getTime();
}

export function purgedKnowledgeDocumentValues(documentId, now = new Date()) {
  return {
    title: "Document purgé",
    purposeDescription: "Contenu supprimé selon la politique de conservation approuvée.",
    originalName: "[purged]",
    mimeType: "application/octet-stream",
    sizeBytes: 1,
    storagePath: `purged/${documentId}`,
    status: "purged",
    checksum: null,
    analysisSummary: "Contenu et extraits supprimés selon la politique approuvée.",
    proposedKnowledge: {},
    analysisError: null,
    purgeStatus: "purged",
    purgedAt: now,
    lastPurgeError: null,
  };
}

export function boundedPurgeError(error) {
  const value = error instanceof Error ? error.message : String(error ?? "unknown_error");
  return value.replace(/[\u0000-\u001F\u007F]/g, "").slice(0, 240) || "unknown_error";
}
