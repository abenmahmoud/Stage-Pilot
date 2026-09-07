import { useState } from "react";
import { BadgeCheck, LoaderCircle, Save } from "lucide-react";
import { apiFetch } from "../../lib/api";
import {
  parseScheduleSlotWritePayload,
  type ScheduleSlotWritePayload,
} from "../../../shared/schedule-slot-write-payload";
import type { SchedulePageMappingPayload as SchedulePageMapping } from "../../../shared/schedule-admin-payload";

type DraftRow = {
  key: string;
  date: string;
  startTime: string;
  endTime: string;
  subjectCode: string;
  subjectLabel: string;
  roomCode: string;
  weekPattern: string;
  groupRef: string;
};

const MAX_ROWS = 80;

function emptyRow(): DraftRow {
  return {
    key: crypto.randomUUID(),
    date: "",
    startTime: "",
    endTime: "",
    subjectCode: "",
    subjectLabel: "",
    roomCode: "",
    weekPattern: "",
    groupRef: "",
  };
}

function toIsoInstant(date: string, time: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) return null;
  const value = new Date(`${date}T${time}:00.000Z`);
  return Number.isFinite(value.getTime()) ? value.toISOString() : null;
}

function rowIsUsable(row: DraftRow): boolean {
  const startsAt = toIsoInstant(row.date, row.startTime);
  const endsAt = toIsoInstant(row.date, row.endTime);
  return Boolean(
    startsAt
    && endsAt
    && Date.parse(endsAt) > Date.parse(startsAt)
    && row.subjectCode.trim().length >= 1
    && row.subjectLabel.trim().length >= 2
  );
}

function formatTime(value: string): string {
  return new Intl.DateTimeFormat("fr-FR", { timeStyle: "short", timeZone: "UTC" }).format(new Date(value));
}

interface ScheduleSlotEditorProps {
  importId: string;
  page: SchedulePageMapping;
  onWritten: (pageNumber: number, slots: ScheduleSlotWritePayload[]) => void;
}

export default function ScheduleSlotEditor({ importId, page, onWritten }: ScheduleSlotEditorProps) {
  const [rows, setRows] = useState<DraftRow[]>([emptyRow()]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [report, setReport] = useState<ScheduleSlotWritePayload[] | null>(null);

  const usableRows = rows.filter(rowIsUsable);
  const hasUnusableRow = rows.some((row) => {
    const touched = row.date || row.startTime || row.endTime || row.subjectCode || row.subjectLabel;
    return touched && !rowIsUsable(row);
  });
  const canSubmit = usableRows.length >= 1 && usableRows.length === rows.length && !hasUnusableRow;

  function updateRow(key: string, patch: Partial<DraftRow>) {
    setRows((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  }

  function addRow() {
    setRows((current) => (current.length >= MAX_ROWS ? current : [...current, emptyRow()]));
  }

  function removeRow(key: string) {
    setRows((current) => (current.length > 1 ? current.filter((row) => row.key !== key) : current));
  }

  async function submit() {
    if (!canSubmit) return;
    setBusy(true);
    setError("");
    try {
      const body = {
        rows: usableRows.map((row) => ({
          subjectCode: row.subjectCode.trim(),
          subjectLabel: row.subjectLabel.trim(),
          roomCode: row.roomCode.trim() || null,
          startsAt: toIsoInstant(row.date, row.startTime),
          endsAt: toIsoInstant(row.date, row.endTime),
          weekPattern: row.weekPattern.trim() || null,
          groupRef: row.groupRef.trim() || null,
        })),
      };
      const response = await apiFetch<unknown>(
        `schedule/admin/imports/${importId}/pages/${page.id}/slots`,
        { method: "POST", body: JSON.stringify(body) }
      );
      const result = parseScheduleSlotWritePayload(response, {
        subjectType: page.subjectType,
        subjectRef: page.subjectRef,
        rowCount: usableRows.length,
      });
      if (!result) throw new Error("La confirmation d'écriture des créneaux reçue est invalide.");
      setReport(result.slots);
      onWritten(page.pageNumber, result.slots);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Écriture des créneaux impossible.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-2 space-y-3 border border-slate-200 bg-slate-50 p-3">
      <p className="text-xs font-semibold text-slate-600">
        Créneaux de la page {page.pageNumber} ({page.subjectRef}) — chaque envoi remplace entièrement
        les créneaux précédemment écrits pour cette page.
      </p>
      {error ? <p role="alert" className="text-xs font-medium text-red-800">{error}</p> : null}
      <div className="space-y-2">
        {rows.map((row) => (
          <div
            key={row.key}
            className="grid gap-2 sm:grid-cols-[110px_84px_84px_100px_minmax(0,1fr)_90px_80px_80px_auto] sm:items-center"
          >
            <input
              type="date"
              className="field bg-white text-xs"
              value={row.date}
              disabled={busy}
              onChange={(event) => updateRow(row.key, { date: event.target.value })}
              aria-label="Jour"
            />
            <input
              type="time"
              className="field bg-white text-xs"
              value={row.startTime}
              disabled={busy}
              onChange={(event) => updateRow(row.key, { startTime: event.target.value })}
              aria-label="Heure de début"
            />
            <input
              type="time"
              className="field bg-white text-xs"
              value={row.endTime}
              disabled={busy}
              onChange={(event) => updateRow(row.key, { endTime: event.target.value })}
              aria-label="Heure de fin"
            />
            <input
              className="field bg-white text-xs uppercase"
              value={row.subjectCode}
              maxLength={32}
              placeholder="Code matière"
              disabled={busy}
              onChange={(event) => updateRow(row.key, { subjectCode: event.target.value })}
              aria-label="Code matière"
            />
            <input
              className="field bg-white text-xs"
              value={row.subjectLabel}
              maxLength={120}
              placeholder="Intitulé de la matière"
              disabled={busy}
              onChange={(event) => updateRow(row.key, { subjectLabel: event.target.value })}
              aria-label="Intitulé de la matière"
            />
            <input
              className="field bg-white text-xs"
              value={row.roomCode}
              maxLength={40}
              placeholder="Salle"
              disabled={busy}
              onChange={(event) => updateRow(row.key, { roomCode: event.target.value })}
              aria-label="Salle"
            />
            <input
              className="field bg-white text-xs"
              value={row.weekPattern}
              maxLength={16}
              placeholder="Semaine"
              disabled={busy}
              onChange={(event) => updateRow(row.key, { weekPattern: event.target.value })}
              aria-label="Alternance de semaine"
            />
            <input
              className="field bg-white text-xs uppercase"
              value={row.groupRef}
              maxLength={80}
              placeholder="Groupe"
              disabled={busy}
              onChange={(event) => updateRow(row.key, { groupRef: event.target.value })}
              aria-label="Groupe"
            />
            <button
              type="button"
              onClick={() => removeRow(row.key)}
              disabled={busy || rows.length <= 1}
              className="text-xs font-semibold text-red-700 disabled:opacity-30"
            >
              Retirer
            </button>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={addRow}
          disabled={busy || rows.length >= MAX_ROWS}
          className="text-xs font-semibold text-emerald-700 disabled:opacity-40"
        >
          + Ajouter un créneau
        </button>
        <button
          type="button"
          onClick={() => void submit()}
          disabled={busy || !canSubmit}
          className="inline-flex min-h-8 items-center gap-1.5 rounded-md bg-slate-950 px-3 text-xs font-semibold text-white disabled:opacity-40"
        >
          {busy ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          Écrire les créneaux
        </button>
        {hasUnusableRow ? (
          <span className="text-xs text-amber-800">Complétez ou retirez les lignes incomplètes.</span>
        ) : null}
      </div>
      {report ? (
        <div className="border-t border-slate-200 pt-2">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-emerald-800">
            <BadgeCheck className="h-3.5 w-3.5" />
            {report.length} créneau{report.length > 1 ? "x" : ""} écrit{report.length > 1 ? "s" : ""} pour {page.subjectRef}
          </p>
          <ul className="mt-1 space-y-0.5 text-xs text-slate-600">
            {report.map((slot) => (
              <li key={slot.id}>
                {formatTime(slot.startsAt)}–{formatTime(slot.endsAt)} · {slot.subjectLabel}
                {slot.roomCode ? ` · ${slot.roomCode}` : ""}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
