import { useEffect, useState } from "react";
import { BadgeCheck, LoaderCircle, Table } from "lucide-react";
import { apiFetch } from "../../lib/api";
import { parseScheduleSlotBatchInput } from "../../../shared/schedule-slot-input";
import {
  SCHEDULE_TABULAR_OPTIONAL_FIELDS,
  SCHEDULE_TABULAR_REQUIRED_FIELDS,
  type ScheduleTabularColumnMapping,
  type ScheduleTabularField,
} from "../../../shared/schedule-tabular-mapping";
import type { ScheduleSlotRowInput } from "../../../shared/schedule-slot-input";

const FIELD_LABELS: Record<ScheduleTabularField, string> = {
  subjectRef: "Classe ou professeur",
  subjectCode: "Code matière",
  subjectLabel: "Intitulé de la matière",
  date: "Date",
  startTime: "Heure de début",
  endTime: "Heure de fin",
  roomCode: "Salle",
  weekPattern: "Alternance de semaine",
  groupRef: "Groupe",
};

export type ScheduleTabularComputedPage = {
  pageNumber: number;
  subjectType: "class" | "teacher";
  subjectRef: string;
  rows: ScheduleSlotRowInput[];
};

function emptyMapping(): Partial<ScheduleTabularColumnMapping> {
  const draft: Partial<ScheduleTabularColumnMapping> = {};
  for (const field of SCHEDULE_TABULAR_OPTIONAL_FIELDS) draft[field] = null;
  return draft;
}

function parseComputedPages(
  value: unknown,
  expected: { subjectType: "class" | "teacher"; groupCount: number }
): ScheduleTabularComputedPage[] | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const root = value as Record<string, unknown>;
  if (!Array.isArray(root.pages) || root.pages.length !== expected.groupCount) return null;
  const pages: ScheduleTabularComputedPage[] = [];
  let previousPage = 0;
  for (const entry of root.pages) {
    if (!entry || typeof entry !== "object") return null;
    const row = entry as Record<string, unknown>;
    if (
      !Number.isInteger(row.pageNumber) ||
      Number(row.pageNumber) <= previousPage ||
      row.subjectType !== expected.subjectType ||
      typeof row.subjectRef !== "string"
    ) return null;
    let batch;
    try {
      batch = parseScheduleSlotBatchInput({ rows: row.rows });
    } catch {
      return null;
    }
    previousPage = Number(row.pageNumber);
    pages.push({
      pageNumber: Number(row.pageNumber),
      subjectType: expected.subjectType,
      subjectRef: row.subjectRef,
      rows: batch.rows,
    });
  }
  return pages;
}

interface ScheduleTabularMappingPanelProps {
  importId: string;
  sourceKind: "classes" | "teachers";
  onApplied: (pages: ScheduleTabularComputedPage[]) => void;
}

export default function ScheduleTabularMappingPanel({
  importId,
  sourceKind,
  onApplied,
}: ScheduleTabularMappingPanelProps) {
  const [headers, setHeaders] = useState<string[]>([]);
  const [rowCount, setRowCount] = useState(0);
  const [draft, setDraft] = useState<Partial<ScheduleTabularColumnMapping>>(emptyMapping());
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [applied, setApplied] = useState<{ groupCount: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    setApplied(null);
    apiFetch<unknown>(`schedule/admin/imports/${importId}/tabular-mapping`)
      .then((response) => {
        if (cancelled) return;
        const root = response as Record<string, unknown>;
        const receivedHeaders = Array.isArray(root.headers)
          ? root.headers.filter((header): header is string => typeof header === "string")
          : [];
        if (receivedHeaders.length === 0) throw new Error("Aucune colonne n'a été lue dans ce fichier.");
        setHeaders(receivedHeaders);
        setRowCount(typeof root.rowCount === "number" ? root.rowCount : 0);
        const saved = root.savedMapping as Partial<ScheduleTabularColumnMapping> | null;
        setDraft(saved ?? emptyMapping());
      })
      .catch((reason) => {
        if (!cancelled) setError(reason instanceof Error ? reason.message : "Lecture des colonnes impossible.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [importId]);

  const usedHeaders = new Set(Object.values(draft).filter((value): value is string => typeof value === "string"));
  const canSubmit = SCHEDULE_TABULAR_REQUIRED_FIELDS.every((field) => Boolean(draft[field]));

  function updateField(field: ScheduleTabularField, value: string) {
    setDraft((current) => ({ ...current, [field]: value === "" ? (SCHEDULE_TABULAR_OPTIONAL_FIELDS as readonly string[]).includes(field) ? null : undefined : value }));
  }

  async function submit() {
    if (!canSubmit) return;
    setBusy(true);
    setError("");
    try {
      const mapping: ScheduleTabularColumnMapping = {
        subjectRef: draft.subjectRef!,
        subjectCode: draft.subjectCode!,
        subjectLabel: draft.subjectLabel!,
        date: draft.date!,
        startTime: draft.startTime!,
        endTime: draft.endTime!,
        roomCode: draft.roomCode ?? null,
        weekPattern: draft.weekPattern ?? null,
        groupRef: draft.groupRef ?? null,
      };
      const response = await apiFetch<unknown>(`schedule/admin/imports/${importId}/tabular-mapping`, {
        method: "POST",
        body: JSON.stringify({ mapping }),
      });
      const root = response as Record<string, unknown>;
      const groupCount = Array.isArray(root.pages) ? root.pages.length : -1;
      const pages = parseComputedPages(response, {
        subjectType: sourceKind === "classes" ? "class" : "teacher",
        groupCount,
      });
      if (!pages) throw new Error("La confirmation de correspondance reçue est invalide.");
      setApplied({ groupCount: pages.length });
      onApplied(pages);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Application de la correspondance impossible.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-32 items-center justify-center border-y border-slate-200 bg-white">
        <LoaderCircle className="h-7 w-7 animate-spin text-emerald-700" />
      </div>
    );
  }

  return (
    <section className="space-y-4 border-y border-slate-200 bg-white p-4 sm:p-6">
      <div className="flex items-center gap-2">
        <Table className="h-5 w-5 text-emerald-700" />
        <div>
          <h2 className="text-lg font-bold text-slate-950">Correspondance des colonnes</h2>
          <p className="text-sm text-slate-500">
            {headers.length} colonne{headers.length > 1 ? "s" : ""} lue{headers.length > 1 ? "s" : ""}, {rowCount} ligne{rowCount > 1 ? "s" : ""}.
            Faites correspondre chaque champ à une colonne du fichier — rien n'est deviné.
          </p>
        </div>
      </div>
      {error ? <p role="alert" className="border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p> : null}
      <div className="grid gap-3 sm:grid-cols-2">
        {[...SCHEDULE_TABULAR_REQUIRED_FIELDS, ...SCHEDULE_TABULAR_OPTIONAL_FIELDS].map((field) => {
          const isOptional = (SCHEDULE_TABULAR_OPTIONAL_FIELDS as readonly string[]).includes(field);
          const value = draft[field] ?? "";
          return (
            <label key={field} className="text-sm font-medium text-slate-700">
              {FIELD_LABELS[field]}
              {isOptional ? <span className="font-normal text-slate-500"> (facultatif)</span> : null}
              <select
                className="field mt-1 bg-white"
                value={value ?? ""}
                disabled={busy}
                onChange={(event) => updateField(field, event.target.value)}
              >
                <option value="">{isOptional ? "— aucune —" : "— choisir une colonne —"}</option>
                {headers.map((header) => (
                  <option key={header} value={header} disabled={usedHeaders.has(header) && draft[field] !== header}>
                    {header}
                  </option>
                ))}
              </select>
            </label>
          );
        })}
      </div>
      <button
        type="button"
        onClick={() => void submit()}
        disabled={busy || !canSubmit}
        className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-slate-950 px-4 text-sm font-semibold text-white disabled:opacity-40"
      >
        {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <BadgeCheck className="h-4 w-4" />}
        Appliquer la correspondance
      </button>
      {applied ? (
        <p className="flex items-center gap-1.5 text-sm font-semibold text-emerald-800">
          <BadgeCheck className="h-4 w-4" />
          {applied.groupCount} page{applied.groupCount > 1 ? "s" : ""} créée{applied.groupCount > 1 ? "s" : ""}. Vérifiez puis écrivez les créneaux ci-dessous, comme pour un PDF.
        </p>
      ) : null}
    </section>
  );
}
