import { STAGE_STATUS, GO_STATUS, type StageStatut, type GOStatut } from "../../lib/types";

export function StageStatusBadge({ status }: { status: StageStatut }) {
  const info = STAGE_STATUS[status] ?? { label: status, color: "bg-gray-100 text-gray-600" };
  return (
    <span className={`inline-flex items-center rounded-lg px-2.5 py-1 text-xs font-semibold ${info.color}`}>
      {info.label}
    </span>
  );
}

export function GoStatusBadge({ status }: { status: GOStatut }) {
  const info = GO_STATUS[status] ?? { label: status, color: "bg-gray-100 text-gray-600" };
  return (
    <span className={`inline-flex items-center rounded-lg px-2.5 py-1 text-xs font-semibold ${info.color}`}>
      {info.label}
    </span>
  );
}
