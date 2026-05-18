import { useState, useCallback } from "react";
import { apiFetch } from "../../lib/api";
import { Card, CardContent, CardHeader } from "../../components/ui/Card";
import Papa from "papaparse";
import {
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
  ArrowLeft,
  Info,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

type ImportType = "eleves" | "professeurs";

interface ParsedRow {
  [key: string]: string;
}

interface MappedRow {
  nom: string;
  prenom: string;
  classe?: string;
  email?: string;
  emailEleve?: string;
  emailFamille?: string;
  telephoneFamille?: string;
  dateNaissance?: string;
  matieres?: string;
  status: "ok" | "doublon" | "erreur";
  erreur?: string;
}

const FIELD_ALIASES: Record<string, string[]> = {
  // SIECLE/STSWEB columns are added in priority (exact match first)
  nom: ["nom", "nom de famille", "surname", "last name", "nom_famille"],
  prenom: ["prenom", "prénom", "first name", "firstname"],
  classe: ["div.", "division", "classe", "class", "div"],
  emailEleve: [
    "email",
    "adresse e-mail",
    "e-mail",
    "mail",
    "email_eleve",
    "courriel élève",
    "courriel eleve",
  ],
  emailFamille: [
    "email représentant légal 1",
    "email famille",
    "email_famille",
    "email parent",
    "courriel resp1",
    "courriel resp. 1",
  ],
  telephoneFamille: [
    "téléphone famille",
    "tel. responsable",
    "telephone_famille",
    "tel famille",
    "tel. resp1",
    "tel. resp. 1",
  ],
  dateNaissance: [
    "ne(e) le",
    "né(e) le",
    "nee le",
    "née le",
    "date de naissance",
    "ddn",
    "birth date",
    "date_naissance",
  ],
  matieres: ["discipline", "matière", "matieres", "matiere", "subject"],
};

function autoMapColumn(csvHeader: string): string | null {
  const lower = csvHeader.toLowerCase().trim();
  // Exact match first
  for (const [field, aliases] of Object.entries(FIELD_ALIASES)) {
    if (aliases.some((a) => lower === a)) return field;
  }
  // Substring match as fallback
  for (const [field, aliases] of Object.entries(FIELD_ALIASES)) {
    if (aliases.some((a) => lower.includes(a))) return field;
  }
  return null;
}

/**
 * Fix the classic SIECLE/Excel bug:
 * When a CSV from SIECLE is opened in Excel, class codes for 2nde GT
 * (named "2E1", "2E2", ..., "2E12" at Lycée Blaise Cendrars) get
 * reinterpreted as scientific notation because Excel reads "2E1" as
 * "2 × 10¹" and reformats it as "2,00E+01" (or "2.00E+01").
 *
 * We restore the original code: "2E" + numeric exponent (no padding).
 *   "2,00E+01" → "2E1"
 *   "2,00E+12" → "2E12"
 *
 * Also handles "2.00E+01" (dot decimal separator).
 */
function fixSiecleClasse(value: string): string {
  const v = value.trim();
  // Match patterns like "2,00E+01", "2.00E+12", with optional sign and leading zeros
  const m = v.match(/^2[,.]00E\+0*(\d+)$/i);
  if (!m) return v;
  const exponent = m[1];
  // Reconstruct: "2E" + numeric exponent (1, 2, ..., 12)
  return "2E" + exponent;
}

/**
 * Detect file encoding by reading a sample and looking for byte sequences
 * that are invalid in UTF-8 but valid in ISO-8859-1.
 * Returns "UTF-8" or "ISO-8859-1".
 */
async function detectEncoding(file: File): Promise<string> {
  const sample = await file.slice(0, 4096).arrayBuffer();
  const bytes = new Uint8Array(sample);

  // Try to decode as UTF-8 strictly. If it throws, it's not valid UTF-8.
  try {
    new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    return "UTF-8";
  } catch {
    return "ISO-8859-1";
  }
}

export default function ImportPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [importType, setImportType] = useState<ImportType>("eleves");
  const [rawData, setRawData] = useState<ParsedRow[]>([]);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [mappedData, setMappedData] = useState<MappedRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [fileInfo, setFileInfo] = useState<{
    encoding: string;
    delimiter: string;
    fixedClasseCount: number;
  } | null>(null);
  const [result, setResult] = useState<{
    imported: number;
    doublons: number;
    erreurs: number;
  } | null>(null);
  const [error, setError] = useState("");

  const handleFile = useCallback(async (file: File) => {
    setError("");

    // Auto-detect encoding (UTF-8 vs ISO-8859-1 from SIECLE/Pronote)
    const encoding = await detectEncoding(file);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      encoding,
      // Empty string lets papaparse auto-detect the delimiter (; or , or \t)
      delimiter: "",
      transformHeader: (h: string) => h.trim(),
      complete(results) {
        const data = results.data as ParsedRow[];
        if (data.length === 0) {
          setError("Le fichier est vide.");
          return;
        }
        const headers = Object.keys(data[0]).filter((h) => h && h.length > 0);

        // Detect delimiter from papaparse meta
        const delimiter = results.meta.delimiter || ";";

        setCsvHeaders(headers);
        setRawData(data);

        const autoMap: Record<string, string> = {};
        for (const h of headers) {
          const field = autoMapColumn(h);
          if (field && !autoMap[field]) autoMap[field] = h;
        }
        setMapping(autoMap);

        // Count how many rows have the SIECLE/Excel bug we'll fix
        let fixedClasseCount = 0;
        if (autoMap.classe) {
          for (const row of data) {
            const v = row[autoMap.classe] || "";
            if (v !== fixSiecleClasse(v)) fixedClasseCount++;
          }
        }

        setFileInfo({ encoding, delimiter, fixedClasseCount });
        setStep(1);
      },
      error() {
        setError("Erreur de lecture du fichier.");
      },
    });
  }, []);

  function applyMapping() {
    const mapped: MappedRow[] = rawData.map((row) => {
      const nom = (row[mapping.nom] || "").trim();
      const prenom = (row[mapping.prenom] || "").trim();
      // Fix the SIECLE/Excel scientific notation bug on classe
      const classeRaw = (row[mapping.classe] || "").trim();
      const classe = fixSiecleClasse(classeRaw);
      const email = (row[mapping.emailEleve] || row[mapping.email] || "").trim();

      let status: MappedRow["status"] = "ok";
      let erreur: string | undefined;
      if (!nom || !prenom) {
        status = "erreur";
        erreur = "Nom ou prénom manquant";
      }
      if (importType === "eleves" && !classe) {
        status = "erreur";
        erreur = (erreur ? erreur + "; " : "") + "Classe manquante";
      }
      if (importType === "professeurs" && !email) {
        status = "erreur";
        erreur = (erreur ? erreur + "; " : "") + "Email manquant";
      }

      return {
        nom,
        prenom,
        classe,
        email,
        emailEleve: email,
        emailFamille: (row[mapping.emailFamille] || "").trim(),
        telephoneFamille: (row[mapping.telephoneFamille] || "").trim(),
        dateNaissance: (row[mapping.dateNaissance] || "").trim(),
        matieres: (row[mapping.matieres] || "").trim(),
        status,
        erreur,
      };
    });
    setMappedData(mapped);
    setStep(2);
  }

  async function handleImport() {
    setImporting(true);
    setError("");
    try {
      const validRows = mappedData.filter((r) => r.status !== "erreur");
      const res = await apiFetch<{
        imported: number;
        doublons: number;
        erreurs: number;
      }>(`import/${importType}`, {
        method: "POST",
        body: JSON.stringify({ rows: validRows }),
      });
      setResult(res);
      setStep(3);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur lors de l'import");
    }
    setImporting(false);
  }

  const targetFields =
    importType === "eleves"
      ? [
          { key: "nom", label: "Nom *" },
          { key: "prenom", label: "Prénom *" },
          { key: "classe", label: "Classe *" },
          { key: "emailEleve", label: "Email élève" },
          { key: "emailFamille", label: "Email famille" },
          { key: "telephoneFamille", label: "Tél. famille" },
          { key: "dateNaissance", label: "Date naissance" },
        ]
      : [
          { key: "nom", label: "Nom *" },
          { key: "prenom", label: "Prénom *" },
          { key: "email", label: "Email *" },
          { key: "matieres", label: "Matières" },
        ];

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <button
        onClick={() => navigate("/admin")}
        className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700"
      >
        <ArrowLeft className="w-4 h-4" />
        Retour
      </button>

      <div>
        <h1 className="text-2xl font-bold font-heading text-gray-900">
          Import CSV
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Importez les listes d'élèves ou de professeurs depuis Pronote / SIECLE
        </p>
      </div>

      {error && (
        <div className="flex items-start gap-3 rounded-xl bg-red-50 border border-red-200 p-4 text-sm text-red-700">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Step 0: Upload */}
      {step === 0 && (
        <Card>
          <CardContent className="space-y-4 py-6">
            <div className="flex gap-3 mb-4">
              <button
                onClick={() => setImportType("eleves")}
                className={`flex-1 rounded-xl py-2.5 text-sm font-medium transition-all ${
                  importType === "eleves"
                    ? "bg-primary-500 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                Élèves
              </button>
              <button
                onClick={() => setImportType("professeurs")}
                className={`flex-1 rounded-xl py-2.5 text-sm font-medium transition-all ${
                  importType === "professeurs"
                    ? "bg-primary-500 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                Enseignants
              </button>
            </div>
            <label className="flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-gray-300 bg-gray-50 p-12 cursor-pointer hover:border-primary-500 hover:bg-primary-50/30 transition-all">
              <FileSpreadsheet className="w-10 h-10 text-gray-400" />
              <p className="text-sm text-gray-500">
                Glissez un fichier .csv ici ou cliquez pour parcourir
              </p>
              <p className="text-xs text-gray-400">
                Compatible SIECLE (séparateur ;, encodage Windows) et Pronote
              </p>
              <input
                type="file"
                accept=".csv,.txt"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f);
                }}
              />
            </label>
          </CardContent>
        </Card>
      )}

      {/* Step 1: Mapping */}
      {step === 1 && (
        <Card>
          <CardHeader>
            <h2 className="text-lg font-bold font-heading">
              Correspondance des colonnes
            </h2>
            <p className="text-sm text-gray-500">
              {rawData.length} lignes détectées. Vérifiez l'association de chaque champ.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {fileInfo && (
              <div className="rounded-xl bg-blue-50 border border-blue-200 p-3 text-sm text-blue-700 space-y-1">
                <div className="flex items-start gap-2">
                  <Info className="w-4 h-4 shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <p>
                      <strong>Format détecté :</strong> encodage{" "}
                      <code className="bg-blue-100 px-1 rounded">{fileInfo.encoding}</code>, séparateur{" "}
                      <code className="bg-blue-100 px-1 rounded">
                        {fileInfo.delimiter === "\t" ? "tab" : fileInfo.delimiter}
                      </code>
                    </p>
                    {fileInfo.fixedClasseCount > 0 && (
                      <p>
                        <strong>{fileInfo.fixedClasseCount} classes corrigées</strong>{" "}
                        automatiquement (Excel a converti "201", "202"... en notation scientifique). C'est fréquent
                        et sera réparé silencieusement.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}
            {targetFields.map((f) => (
              <div key={f.key} className="flex items-center gap-4">
                <span className="w-36 text-sm font-medium text-gray-700">
                  {f.label}
                </span>
                <select
                  value={mapping[f.key] || ""}
                  onChange={(e) =>
                    setMapping((prev) => ({
                      ...prev,
                      [f.key]: e.target.value,
                    }))
                  }
                  className="flex-1 rounded-xl border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500"
                >
                  <option value="">— Non mappé —</option>
                  {csvHeaders.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </div>
            ))}
            <div className="flex justify-end pt-2">
              <button
                onClick={applyMapping}
                className="inline-flex items-center gap-2 rounded-xl bg-primary-500 px-6 py-2.5 text-sm font-semibold text-white hover:bg-primary-600 transition-all"
              >
                Aperçu
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Preview */}
      {step === 2 && (
        <Card>
          <CardHeader>
            <h2 className="text-lg font-bold font-heading">
              Aperçu — {mappedData.length} lignes
            </h2>
            <div className="flex gap-4 text-sm mt-2">
              <span className="text-green-600 font-medium">
                {mappedData.filter((r) => r.status === "ok").length} OK
              </span>
              <span className="text-red-600 font-medium">
                {mappedData.filter((r) => r.status === "erreur").length} erreurs
              </span>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto max-h-96">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-white">
                  <tr className="border-b text-xs font-medium text-gray-500 uppercase">
                    <th className="px-4 py-2">Statut</th>
                    <th className="px-4 py-2">Nom</th>
                    <th className="px-4 py-2">Prénom</th>
                    {importType === "eleves" && (
                      <th className="px-4 py-2">Classe</th>
                    )}
                    <th className="px-4 py-2">Email</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {mappedData.slice(0, 50).map((r, i) => (
                    <tr key={i} className={r.status === "erreur" ? "bg-red-50/50" : ""}>
                      <td className="px-4 py-2">
                        {r.status === "ok" ? (
                          <span className="text-green-600 text-xs font-medium">OK</span>
                        ) : (
                          <span className="text-red-600 text-xs font-medium" title={r.erreur}>
                            Erreur
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2">{r.nom}</td>
                      <td className="px-4 py-2">{r.prenom}</td>
                      {importType === "eleves" && (
                        <td className="px-4 py-2">{r.classe}</td>
                      )}
                      <td className="px-4 py-2">{r.email || r.emailEleve}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {mappedData.length > 50 && (
              <p className="text-xs text-gray-400 text-center py-2">
                Affichage des 50 premières lignes sur {mappedData.length}.
              </p>
            )}
            <div className="flex justify-between p-4 border-t border-gray-100">
              <button
                onClick={() => setStep(1)}
                className="inline-flex items-center gap-2 rounded-xl bg-gray-100 px-5 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-200 transition-all"
              >
                Retour
              </button>
              <button
                onClick={handleImport}
                disabled={importing || mappedData.filter((r) => r.status === "ok").length === 0}
                className="inline-flex items-center gap-2 rounded-xl bg-green-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-green-700 transition-all disabled:opacity-50"
              >
                <Upload className="w-4 h-4" />
                {importing
                  ? "Import en cours…"
                  : `Importer ${mappedData.filter((r) => r.status === "ok").length} lignes`}
              </button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Result */}
      {step === 3 && result && (
        <Card>
          <CardContent className="text-center py-12 space-y-4">
            <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto" />
            <h2 className="text-xl font-bold font-heading text-gray-900">
              Import terminé
            </h2>
            <div className="flex justify-center gap-6 text-sm">
              <span className="text-green-600 font-medium">
                {result.imported} importé(s)
              </span>
              <span className="text-yellow-600 font-medium">
                {result.doublons} doublon(s)
              </span>
              <span className="text-red-600 font-medium">
                {result.erreurs} erreur(s)
              </span>
            </div>
            <button
              onClick={() => {
                setStep(0);
                setResult(null);
                setRawData([]);
                setMappedData([]);
                setFileInfo(null);
              }}
              className="inline-flex items-center gap-2 rounded-xl bg-primary-500 px-6 py-2.5 text-sm font-semibold text-white hover:bg-primary-600 transition-all"
            >
              Nouvel import
            </button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
