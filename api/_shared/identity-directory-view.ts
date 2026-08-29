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
