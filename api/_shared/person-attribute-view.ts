import { personAttributeImports } from "../../db/schema.js";

type PersonAttributeImport = typeof personAttributeImports.$inferSelect;

export function personAttributeImportView(value: PersonAttributeImport) {
  return {
    id: value.id,
    originalName: value.originalName,
    rowCount: value.rowCount,
    status: value.status,
    createdAt: value.createdAt.toISOString(),
    approvedAt: value.approvedAt?.toISOString() ?? null,
  };
}
