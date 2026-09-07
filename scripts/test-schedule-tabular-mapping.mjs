// Recette statique du LOT 3 (`docs/operations/PLAN_IMPORT_UTILISABLE_2026-09-07.md`) :
// prouve que la correspondance de colonnes (a) n'accepte jamais un champ non
// explicitement fourni par l'administrateur, (b) rejette toute
// correspondance pointant vers un en-tête absent du fichier ou réutilisé
// deux fois, et (c) produit exactement la forme de ligne déjà attendue par
// `shared/schedule-slot-input.ts` (même point d'écriture, LOT 1/2).
import assert from "node:assert/strict";
import {
  applyScheduleTabularColumnMapping,
  parseScheduleTabularColumnMapping,
  SCHEDULE_TABULAR_MAX_ROWS_PER_GROUP,
} from "../shared/schedule-tabular-mapping.ts";
import { parseScheduleSlotBatchInput } from "../shared/schedule-slot-input.ts";

const HEADERS = ["Classe", "Professeur", "Matiere", "Intitule", "Salle", "Date", "Debut", "Fin", "Groupe"];

function baseMapping(overrides = {}) {
  return {
    subjectRef: "Classe",
    subjectCode: "Matiere",
    subjectLabel: "Intitule",
    date: "Date",
    startTime: "Debut",
    endTime: "Fin",
    roomCode: "Salle",
    weekPattern: null,
    groupRef: "Groupe",
    ...overrides,
  };
}

let assertions = 0;
function check(condition, message) {
  assert.ok(condition, message);
  assertions += 1;
}

// 1. Une correspondance valide et complète est acceptée telle quelle.
{
  const mapping = parseScheduleTabularColumnMapping(baseMapping(), HEADERS);
  check(mapping !== null, "valid mapping should parse");
  check(mapping.roomCode === "Salle", "optional field mapped to a real header is kept");
  check(mapping.weekPattern === null, "optional field explicitly absent stays null");
}

// 2. Un champ obligatoire manquant est rejeté (jamais de devinette).
{
  const { subjectRef, ...rest } = baseMapping();
  const mapping = parseScheduleTabularColumnMapping(rest, HEADERS);
  check(mapping === null, "missing required field must be rejected");
}

// 3. Un champ pointant vers un en-tête absent du fichier est rejeté.
{
  const mapping = parseScheduleTabularColumnMapping(baseMapping({ subjectRef: "Inexistante" }), HEADERS);
  check(mapping === null, "mapping to a header that does not exist must be rejected");
}

// 4. Deux champs ne peuvent pas partager le même en-tête.
{
  const mapping = parseScheduleTabularColumnMapping(baseMapping({ subjectCode: "Classe" }), HEADERS);
  check(mapping === null, "reusing the same header for two fields must be rejected");
}

// 5. Une clé inconnue (hors liste des champs cibles) est rejetée.
{
  const mapping = parseScheduleTabularColumnMapping({ ...baseMapping(), extra: "Classe" }, HEADERS);
  check(mapping === null, "unknown target field key must be rejected");
}

// 6. Application nominale : deux classes distinctes, chacune une page.
{
  const mapping = parseScheduleTabularColumnMapping(baseMapping(), HEADERS);
  const rows = [
    ["2NDE-01", "Mme Dupont", "MATHS", "Mathematiques", "B12", "2026-09-07", "08:00", "09:00", ""],
    ["2NDE-01", "M. Martin", "FR", "Francais", "A03", "2026-09-07", "09:00", "10:00", "GRP-A"],
    ["1ERE-03", "M. Martin", "FR", "Francais", "A03", "2026-09-08", "10:00", "11:00", ""],
  ];
  const result = applyScheduleTabularColumnMapping({ mapping, headers: HEADERS, rows });
  check(result.ok === true, "nominal application should succeed");
  check(result.groups.length === 2, "rows should group by subjectRef");
  check(result.groups[0].subjectRef === "2NDE-01", "first group order preserved");
  check(result.groups[0].rows.length === 2, "class 2NDE-01 should have two rows");
  check(result.rejectedRowCount === 0, "no row should be rejected in the nominal case");

  // La forme produite doit être acceptée telle quelle par le même point
  // d'écriture que celui déjà utilisé pour la saisie manuelle (LOT 1/2).
  const batch = parseScheduleSlotBatchInput({ rows: result.groups[0].rows });
  check(batch.rows.length === 2, "computed rows must pass the existing write-point validator unchanged");
}

// 7. Ligne invalide (heure de fin avant heure de début) : rejetée, pas
// bloquante pour les autres lignes.
{
  const mapping = parseScheduleTabularColumnMapping(baseMapping(), HEADERS);
  const rows = [
    ["2NDE-01", "Mme Dupont", "MATHS", "Mathematiques", "B12", "2026-09-07", "10:00", "09:00", ""],
    ["2NDE-01", "M. Martin", "FR", "Francais", "A03", "2026-09-07", "09:00", "10:00", ""],
  ];
  const result = applyScheduleTabularColumnMapping({ mapping, headers: HEADERS, rows });
  check(result.ok === true, "partial failure should not block the whole file");
  check(result.rejectedRowCount === 1, "the inverted-time row should be rejected");
  check(result.groups[0].rows.length === 1, "only the valid row should remain");
}

// 8. Ligne avec une référence de classe invalide : rejetée proprement.
{
  const mapping = parseScheduleTabularColumnMapping(baseMapping(), HEADERS);
  const rows = [["!!!", "Mme Dupont", "MATHS", "Mathematiques", "B12", "2026-09-07", "08:00", "09:00", ""]];
  const result = applyScheduleTabularColumnMapping({ mapping, headers: HEADERS, rows });
  check(result.ok === false && result.reason === "no_valid_rows", "an entirely invalid file must be reported clearly");
}

// 9. Date invalide.
{
  const mapping = parseScheduleTabularColumnMapping(baseMapping(), HEADERS);
  const rows = [["2NDE-01", "Mme Dupont", "MATHS", "Mathematiques", "B12", "31/09/2026", "08:00", "09:00", ""]];
  const result = applyScheduleTabularColumnMapping({ mapping, headers: HEADERS, rows });
  check(result.ok === false && result.reason === "no_valid_rows", "an invalid date must reject the row");
}

// 10. Groupe (une classe) dépassant la borne d'écriture par lot est signalé
// nommément plutôt que silencieusement tronqué.
{
  const mapping = parseScheduleTabularColumnMapping(baseMapping(), HEADERS);
  const rows = Array.from({ length: SCHEDULE_TABULAR_MAX_ROWS_PER_GROUP + 1 }, (_, index) => [
    "2NDE-01",
    "Mme Dupont",
    "MATHS",
    "Mathematiques",
    "B12",
    "2026-09-07",
    `08:${String(index % 60).padStart(2, "0")}`,
    `09:${String(index % 60).padStart(2, "0")}`,
    "",
  ]);
  const result = applyScheduleTabularColumnMapping({ mapping, headers: HEADERS, rows });
  check(result.ok === false && result.reason === "group_too_large" && result.detail === "2NDE-01", "an oversized group must be reported by name");
}

// 11. Trop de lignes au total.
{
  const mapping = parseScheduleTabularColumnMapping(baseMapping(), HEADERS);
  const rows = Array.from({ length: 20_001 }, () => [
    "2NDE-01",
    "Mme Dupont",
    "MATHS",
    "Mathematiques",
    "B12",
    "2026-09-07",
    "08:00",
    "09:00",
    "",
  ]);
  const result = applyScheduleTabularColumnMapping({ mapping, headers: HEADERS, rows });
  check(result.ok === false && result.reason === "too_many_rows", "an oversized file must be rejected before grouping");
}

console.log(`schedule-tabular-mapping: ${assertions} assertions passed`);
