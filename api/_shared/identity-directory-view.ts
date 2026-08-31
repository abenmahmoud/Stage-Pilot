import { identityDirectoryImports } from "../../db/schema.js";

type IdentityDirectoryImport = typeof identityDirectoryImports.$inferSelect;

export function identityDirectoryView(value: IdentityDirectoryImport) {
  return {
    id: value.id,
    title: value.title,
    purposeDescription: value.purposeDescription,
    sourceType: value.sourceType,
    originalName: value.originalName,
    mimeType: value.mimeType,
    sizeBytes: value.sizeBytes,
    status: value.status,
    rowCount: value.rowCount,
    validRowCount: value.validRowCount,
    rejectedRowCount: value.rejectedRowCount,
    validationSummary: value.validationSummary,
    uploadedAt: value.uploadedAt,
    approvedAt: value.approvedAt,
    activatedAt: value.activatedAt,
    retiredAt: value.retiredAt,
    retirementReason: value.retirementReason,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
  };
}

function iso(value: Date): string {
  return value.toISOString();
}

export function identityDirectoryListView(value: IdentityDirectoryImport) {
  return {
    id: value.id,
    title: value.title,
    purposeDescription: value.purposeDescription,
    originalName: value.originalName,
    sizeBytes: value.sizeBytes,
    status: value.status,
    rowCount: value.rowCount,
    validRowCount: value.validRowCount,
    rejectedRowCount: value.rejectedRowCount,
    createdAt: iso(value.createdAt),
  };
}

export function identityDirectoryActionView(value: IdentityDirectoryImport) {
  return {
    id: value.id,
    status: value.status,
    updatedAt: iso(value.updatedAt),
  };
}

export function identityDirectoryReportImportView(value: IdentityDirectoryImport) {
  const summary = value.validationSummary
    && typeof value.validationSummary === "object"
    && !Array.isArray(value.validationSummary)
    ? value.validationSummary as Record<string, unknown>
    : {};
  return {
    id: value.id,
    status: value.status,
    rowCount: value.rowCount,
    validRowCount: value.validRowCount,
    rejectedRowCount: value.rejectedRowCount,
    validationSummary: {
      warningRowCount: summary.warningRowCount ?? 0,
      issueCounts: summary.issueCounts ?? {},
    },
  };
}
