import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  FileUp,
  Lock,
  Mail,
  ShieldCheck,
} from "lucide-react";
import { Card, CardContent, CardHeader } from "../../components/ui/Card";
import {
  assertMappingComplete,
  buildNominativeImportReport,
  parseDelimitedFile,
  suggestColumnMapping,
  type NominativeColumnMapping,
  type NominativeImportOutcome,
  type NominativeImportReport,
} from "../../../shared/nominative-import";
import {
  parseNominativeValueRecord,
  type NominativeValueRecord,
} from "../../../shared/nominative-value-policy";
import {
  parseNominativeBeneficiaryContext,
  parseNominativeTemplate,
  type NominativeBeneficiaryContext,
} from "../../../shared/nominative-merge";
import {
  freezeNominativeBatch,
  type FrozenNominativeBatch,
  type NominativeExclusionReason,
} from "../../../shared/nominative-batch";
import {
  buildNominativePreview,
  type NominativePreview,
} from "../../../shared/nominative-send-mode";
import {
  FICTITIOUS_CANTINE_CSV,
  FICTITIOUS_CANTINE_DIRECTORY,
  FICTITIOUS_CANTINE_SCHOOL_YEAR,
  FICTITIOUS_CANTINE_SOURCE_REF,
  FICTITIOUS_CANTINE_TEMPLATE,
  fictitiousBeneficiaryLabel,
} from "../../../shared/nominative-fictitious-fixture";

const INSTITUTION_DEMO = "11111111-1111-4111-8111-111111111111";
const COMMUNICATION_DEMO = "22222222-2222-4222-8222-222222222222";
const VERSION_DEMO = "33333333-3333-4333-8333-333333333333";

const OUTCOME_LABEL: Record<NominativeImportOutcome, string> = {
  ready: "Prêt",
  value_missing: "Valeur manquante",
  match_missing: "Rapprochement absent",
  match_ambiguous: "Rapprochement ambigu",
  source_duplicate: "Doublon dans le fichier",
  contact_missing: "Contact absent",
  contact_revoked: "Contact révoqué",
};

const OUTCOME_HELP: Record<NominativeImportOutcome, string> = {
  ready: "La ligne partira dans le lot.",
  value_missing: "La colonne valeur est vide pour cette personne.",
  match_missing: "Aucune personne du répertoire ne correspond.",
  match_ambiguous: "Plusieurs personnes correspondent : le système ne choisit pas.",
  source_duplicate: "Cette personne apparaît déjà plus haut dans le fichier.",
  contact_missing: "Aucun contact utilisable : remise par un autre canal.",
  contact_revoked: "Le contact a été révoqué et ne peut plus être utilisé.",
};

const EXCLUSION_BY_OUTCOME: Partial<Record<NominativeImportOutcome, NominativeExclusionReason>> = {
  value_missing: "valeur_manquante",
  match_missing: "rapprochement_absent",
  match_ambiguous: "rapprochement_ambigu",
  contact_missing: "contact_absent",
  contact_revoked: "contact_revoque",
};

type Step = 1 | 2 | 3 | 4 | 5;

function StepBadge({ current, step, label }: { current: Step; step: Step; label: string }) {
  const done = current > step;
  const active = current === step;
  return (
    <div className="flex items-center gap-2 min-w-0">
      <span
        className={
          "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold " +
          (done
            ? "bg-emerald-100 text-emerald-700"
            : active
              ? "bg-primary-600 text-white"
              : "bg-gray-100 text-gray-400")
        }
      >
        {done ? "✓" : step}
      </span>
      <span className={"truncate text-xs sm:text-sm " + (active ? "font-semibold text-gray-900" : "text-gray-500")}>
        {label}
      </span>
    </div>
  );
}

export default function EnvoisNominatifsPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>(1);
  const [fileName, setFileName] = useState("");
  const [csvText, setCsvText] = useState("");
  const [schoolYear, setSchoolYear] = useState(FICTITIOUS_CANTINE_SCHOOL_YEAR);
  const [valueFunction, setValueFunction] = useState("cantine_information");
  const [mapping, setMapping] = useState<NominativeColumnMapping>({});
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [report, setReport] = useState<NominativeImportReport | null>(null);
  const [batch, setBatch] = useState<FrozenNominativeBatch | null>(null);
  const [preview, setPreview] = useState<NominativePreview | null>(null);
  const [selected, setSelected] = useState(0);
  const [error, setError] = useState("");

  const template = useMemo(() => parseNominativeTemplate({ ...FICTITIOUS_CANTINE_TEMPLATE }), []);

  function loadText(text: string, name: string) {
    setError("");
    try {
      const parsed = parseDelimitedFile(text);
      setCsvText(text);
      setFileName(name);
      setHeaders(parsed.headers);
      setRows(parsed.rows);
      setMapping(suggestColumnMapping(parsed.headers));
      setReport(null);
      setBatch(null);
      setPreview(null);
      setStep(2);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Fichier illisible");
    }
  }

  async function onFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    loadText(await file.text(), file.name);
  }

  function confirmColumns() {
    setError("");
    if (valueFunction !== "cantine_information" && valueFunction !== "badge_number") {
      setError(
        "Cette valeur ouvre un accès. Elle relève du coffre de remise de codes, " +
          "pas du circuit de diffusion : l’import s’arrête ici."
      );
      return;
    }
    try {
      assertMappingComplete(mapping, headers.length);
      setReport(
        buildNominativeImportReport({
          rows,
          mapping,
          directory: [...FICTITIOUS_CANTINE_DIRECTORY],
        })
      );
      setStep(3);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Colonnes incomplètes");
    }
  }

  function buildPreview() {
    if (!report) return;
    setError("");
    try {
      const records = new Map<string, NominativeValueRecord>();
      const beneficiaries = new Map<string, NominativeBeneficiaryContext>();
      const lines = [];
      for (const row of report.rows) {
        if (row.outcome !== "ready" || !row.beneficiaryRef || !row.contactRef || !row.value) continue;
        const person = FICTITIOUS_CANTINE_DIRECTORY.find(
          (item) => item.beneficiaryRef === row.beneficiaryRef
        );
        if (!person) continue;
        const record = parseNominativeValueRecord(
          {
            beneficiaryRef: row.beneficiaryRef,
            valueFunction: "cantine_information",
            value: row.value,
            schoolYear,
            sourceRef: FICTITIOUS_CANTINE_SOURCE_REF,
          },
          () => sha256Hasher()
        );
        records.set(row.beneficiaryRef, record);
        beneficiaries.set(
          row.beneficiaryRef,
          parseNominativeBeneficiaryContext({
            beneficiaryRef: row.beneficiaryRef,
            firstName: person.firstName,
            lastName: person.lastName,
            classLabel: person.classLabel,
          })
        );
        lines.push({
          beneficiaryRef: row.beneficiaryRef,
          contactRef: row.contactRef,
          valueVersion: record.valueVersion,
        });
      }

      const ready = new Set(lines.map((line) => line.beneficiaryRef));
      const exclusions = [];
      const seen = new Set<string>();
      for (const row of report.rows) {
        const reason = EXCLUSION_BY_OUTCOME[row.outcome];
        if (!reason || !row.beneficiaryRef) continue;
        if (ready.has(row.beneficiaryRef) || seen.has(row.beneficiaryRef)) continue;
        seen.add(row.beneficiaryRef);
        exclusions.push({ beneficiaryRef: row.beneficiaryRef, reason });
      }

      const frozen = freezeNominativeBatch(
        {
          institutionId: INSTITUTION_DEMO,
          sourceRef: FICTITIOUS_CANTINE_SOURCE_REF,
          schoolYear,
          templateRef: template.templateRef,
          templateHash: syncHashHex(
            template.templateRef + "\n" + template.subject + "\n" + template.preheader + "\n" + template.bodyText
          ),
          lines,
          exclusions,
        },
        () => sha256Hasher()
      );
      setBatch(frozen);
      setPreview(
        buildNominativePreview({
          mode: "simulation",
          batch: frozen,
          template,
          beneficiaries,
          records,
        })
      );
      setSelected(0);
      setStep(4);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Aperçu impossible");
    }
  }

  const current = preview?.items[selected] ?? null;

  return (
    <div className="mx-auto w-full max-w-5xl space-y-5 px-3 sm:px-0">
      <button
        onClick={() => navigate("/admin")}
        className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700"
      >
        <ArrowLeft className="h-4 w-4" />
        Retour
      </button>

      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-xl font-bold text-gray-900 sm:text-2xl">
          Envois nominatifs — informations de cantine
        </h1>
        <p className="text-sm text-gray-500">
          Un message par élève, contenant uniquement sa propre information. Ce parcours
          fonctionne ici en simulation : aucun message ne part.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-2 rounded-2xl border border-gray-200 bg-white p-3 sm:grid-cols-5">
        <StepBadge current={step} step={1} label="Importer" />
        <StepBadge current={step} step={2} label="Colonnes" />
        <StepBadge current={step} step={3} label="Bilan" />
        <StepBadge current={step} step={4} label="Aperçu" />
        <StepBadge current={step} step={5} label="Lot validé" />
      </div>

      <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
        <Lock className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          Mode simulation : aucune requête n’est envoyée au prestataire, et les données
          affichées proviennent du jeu d’essai fictif. L’envoi réel reste fermé tant que
          l’administration ne l’a pas ouvert.
        </p>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {step === 1 && (
        <Card>
          <CardHeader>
            <h2 className="font-semibold text-gray-900">1. Importer le fichier</h2>
          </CardHeader>
          <CardContent className="space-y-4">
            <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-gray-200 p-6 text-center hover:border-primary-400">
              <FileUp className="h-6 w-6 text-gray-400" />
              <span className="text-sm font-medium text-gray-700">Choisir un fichier CSV</span>
              <span className="text-xs text-gray-500">
                Le fichier est lu dans le navigateur ; rien n’est envoyé tant que vous n’avez
                pas validé un lot.
              </span>
              <input type="file" accept=".csv,text/csv" className="hidden" onChange={onFile} />
            </label>
            <button
              onClick={() => loadText(FICTITIOUS_CANTINE_CSV, "cantine-2026-2027-fictif.csv")}
              className="w-full rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-gray-800"
            >
              Charger le jeu d’essai fictif
            </button>
          </CardContent>
        </Card>
      )}

      {step === 2 && (
        <Card>
          <CardHeader>
            <h2 className="font-semibold text-gray-900">2. Confirmer les colonnes</h2>
            <p className="text-xs text-gray-500">{fileName}</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm">
                <span className="mb-1 block text-gray-600">Année scolaire</span>
                <input
                  value={schoolYear}
                  onChange={(event) => setSchoolYear(event.target.value)}
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm outline-none focus:border-primary-500"
                />
              </label>
              <label className="text-sm">
                <span className="mb-1 block text-gray-600">Que permet cette valeur ?</span>
                <select
                  value={valueFunction}
                  onChange={(event) => setValueFunction(event.target.value)}
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm outline-none focus:border-primary-500"
                >
                  <option value="cantine_information">Information de cantine (sans accès)</option>
                  <option value="badge_number">Numéro de badge (sans accès)</option>
                  <option value="access_secret">Code d’accès à un service</option>
                  <option value="activation_secret">Code d’activation de compte</option>
                </select>
              </label>
            </div>
            <p className="rounded-xl bg-gray-50 p-3 text-xs text-gray-600">
              Le titre de la colonne ne suffit pas : c’est ce que la valeur permet de faire
              qui décide du circuit. Un code d’accès ne passe pas par la diffusion.
            </p>
            <div className="space-y-2">
              {(["beneficiary_ref", "last_name", "first_name", "class_label", "value"] as const).map((role) => (
                <label key={role} className="flex flex-col gap-1 text-sm sm:flex-row sm:items-center sm:gap-3">
                  <span className="w-full text-gray-600 sm:w-44">
                    {role === "beneficiary_ref"
                      ? "Référence élève"
                      : role === "last_name"
                        ? "Nom"
                        : role === "first_name"
                          ? "Prénom"
                          : role === "class_label"
                            ? "Classe"
                            : "Valeur à transmettre"}
                  </span>
                  <select
                    value={mapping[role] ?? -1}
                    onChange={(event) => {
                      const index = Number(event.target.value);
                      setMapping((previous) => ({
                        ...previous,
                        [role]: index < 0 ? undefined : index,
                      }));
                    }}
                    className="w-full flex-1 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm outline-none focus:border-primary-500"
                  >
                    <option value={-1}>— non utilisée —</option>
                    {headers.map((header, index) => (
                      <option key={header} value={index}>
                        {header}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
            <button
              onClick={confirmColumns}
              className="w-full rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-700"
            >
              Vérifier les associations
            </button>
          </CardContent>
        </Card>
      )}

      {step === 3 && report && (
        <Card>
          <CardHeader>
            <h2 className="font-semibold text-gray-900">3. Bilan du rapprochement</h2>
            <p className="text-xs text-gray-500">
              {report.readyCount} prêt(s) sur {report.totalRows} ligne(s)
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {(Object.keys(report.byOutcome) as NominativeImportOutcome[])
                .filter((outcome) => report.byOutcome[outcome] > 0)
                .map((outcome) => (
                  <div
                    key={outcome}
                    className={
                      "rounded-xl border p-3 " +
                      (outcome === "ready"
                        ? "border-emerald-200 bg-emerald-50"
                        : "border-gray-200 bg-gray-50")
                    }
                  >
                    <p className="text-sm font-semibold text-gray-900">
                      {report.byOutcome[outcome]} — {OUTCOME_LABEL[outcome]}
                    </p>
                    <p className="text-xs text-gray-600">{OUTCOME_HELP[outcome]}</p>
                  </div>
                ))}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-left text-sm">
                <thead className="text-xs uppercase text-gray-500">
                  <tr>
                    <th className="py-2 pr-3">Ligne</th>
                    <th className="py-2 pr-3">Bénéficiaire</th>
                    <th className="py-2 pr-3">Rapproché par</th>
                    <th className="py-2">État</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {report.rows.map((row) => (
                    <tr key={row.rowNumber}>
                      <td className="py-2 pr-3 text-gray-500">{row.rowNumber}</td>
                      <td className="py-2 pr-3 text-gray-900">
                        {row.beneficiaryRef
                          ? fictitiousBeneficiaryLabel(row.beneficiaryRef)
                          : row.candidateRefs.length > 1
                            ? row.candidateRefs.map(fictitiousBeneficiaryLabel).join(" ou ")
                            : "—"}
                      </td>
                      <td className="py-2 pr-3 text-xs text-gray-500">
                        {row.matchedBy === "reference"
                          ? "référence"
                          : row.matchedBy === "name_and_class"
                            ? "nom et classe"
                            : "—"}
                      </td>
                      <td className="py-2 text-xs">
                        <span
                          className={
                            "rounded-full px-2 py-0.5 " +
                            (row.outcome === "ready"
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-gray-100 text-gray-600")
                          }
                        >
                          {OUTCOME_LABEL[row.outcome]}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <button
              onClick={buildPreview}
              disabled={report.readyCount === 0}
              className="w-full rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-700 disabled:bg-gray-200 disabled:text-gray-500"
            >
              Voir les messages ({report.readyCount})
            </button>
          </CardContent>
        </Card>
      )}

      {step === 4 && preview && batch && (
        <Card>
          <CardHeader>
            <h2 className="font-semibold text-gray-900">4. Message par destinataire</h2>
            <p className="text-xs text-gray-500">
              {preview.items.length} message(s) — {preview.providerCallsPlanned} appel(s) au
              prestataire prévus
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {preview.items.map((item, index) => (
                <button
                  key={item.beneficiaryRef}
                  onClick={() => setSelected(index)}
                  className={
                    "rounded-full px-3 py-1.5 text-xs " +
                    (index === selected
                      ? "bg-primary-600 text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200")
                  }
                >
                  {fictitiousBeneficiaryLabel(item.beneficiaryRef)}
                </button>
              ))}
            </div>

            {current && (
              <div className="space-y-2 rounded-xl border border-gray-200 p-3">
                <p className="text-xs text-gray-500">
                  Destinataire : <span className="font-mono">{current.contactRef}</span>
                </p>
                <p className="text-sm font-semibold text-gray-900">{current.subject}</p>
                <p className="text-xs text-gray-500">{current.preheader}</p>
                <pre className="overflow-x-auto whitespace-pre-wrap break-words rounded-lg bg-gray-50 p-3 text-sm text-gray-800">
                  {current.bodyText}
                </pre>
                <p className="text-[11px] text-gray-400">
                  version de valeur {current.valueVersion.slice(0, 12)}…
                </p>
              </div>
            )}

            {preview.items.length > 1 && (
              <p className="flex items-start gap-2 rounded-xl bg-gray-50 p-3 text-xs text-gray-600">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                Deux élèves peuvent partager la même adresse : chaque message est fusionné
                séparément et ne contient que la valeur de son bénéficiaire.
              </p>
            )}

            <button
              onClick={() => setStep(5)}
              className="w-full rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-700"
            >
              Valider ce lot
            </button>
          </CardContent>
        </Card>
      )}

      {step === 5 && batch && preview && (
        <Card>
          <CardHeader>
            <h2 className="font-semibold text-gray-900">5. Lot validé (simulation)</h2>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <p className="font-medium">
                  {batch.readyCount} message(s) figé(s), {batch.excludedCount} exclusion(s)
                </p>
                <p className="text-xs">
                  Empreinte du lot {batch.scopeHash.slice(0, 16)}… — si une valeur, un contact
                  ou le modèle change, ce lot redevient à vérifier.
                </p>
              </div>
            </div>

            <div className="space-y-2">
              {preview.items.map((item) => (
                <div
                  key={item.beneficiaryRef}
                  className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 p-3 text-sm"
                >
                  <span className="min-w-0 truncate text-gray-900">
                    {fictitiousBeneficiaryLabel(item.beneficiaryRef)}
                  </span>
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                    <Mail className="h-3 w-3" />
                    Simulé
                  </span>
                </div>
              ))}
            </div>

            {batch.exclusions.length > 0 && (
              <div className="rounded-xl border border-gray-200 p-3">
                <p className="mb-2 text-sm font-medium text-gray-900">
                  Exclusions ({batch.exclusions.length})
                </p>
                <ul className="space-y-1 text-xs text-gray-600">
                  {batch.exclusions.map((exclusion) => (
                    <li key={exclusion.beneficiaryRef} className="flex flex-wrap gap-x-2">
                      <span className="text-gray-900">
                        {fictitiousBeneficiaryLabel(exclusion.beneficiaryRef)}
                      </span>
                      <span>— {exclusion.reason.replace(/_/g, " ")}</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-xs text-gray-500">
                  Ces lignes restent visibles et pourront former un lot complémentaire.
                </p>
              </div>
            )}

            <p className="rounded-xl bg-gray-50 p-3 text-xs text-gray-600">
              L’envoi réel n’est pas déclenché depuis cet écran : il demande l’ouverture
              explicite du drapeau d’envoi et une cible confirmée par l’administration.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/* Petit hachage SHA-256 synchrone pour l'aperçu local, sans dépendance. */
function sha256Hasher() {
  const parts: string[] = [];
  return {
    update(data: string) {
      parts.push(data);
      return this;
    },
    digest(_encoding: "hex") {
      return syncHashHex(parts.join(""));
    },
  };
}

function syncHashHex(input: string): string {
  // FNV-1a 32 bits repete sur huit graines : suffisant pour distinguer des
  // versions dans un apercu local. Le serveur recalcule les vraies empreintes
  // SHA-256 avant toute mise en file.
  let output = "";
  for (let seed = 0; seed < 8; seed += 1) {
    let hash = 0x811c9dc5 ^ (seed * 0x01000193);
    for (let index = 0; index < input.length; index += 1) {
      hash ^= input.charCodeAt(index);
      hash = Math.imul(hash, 0x01000193) >>> 0;
    }
    output += hash.toString(16).padStart(8, "0");
  }
  return output;
}
