import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "../../lib/api";
import { Card, CardContent, CardHeader } from "../../components/ui/Card";
import {
  ArrowLeft,
  ChevronDown,
  Download,
  Filter,
  Printer,
  Search,
} from "lucide-react";

interface ProfCode {
  id: string;
  nom: string;
  prenom: string;
  codeAcces: string | null;
  matieres: string | null;
  email: string | null;
}

interface CodesProfsResponse {
  total: number;
  profs: ProfCode[];
  parMatiere: Array<{ nom: string; nb: number }>;
}

const PRINT_STYLES = `
  @media print {
    @page {
      size: A4 portrait;
      margin: 8mm;
    }

    html,
    body {
      background: white !important;
      width: 210mm;
      min-height: 297mm;
    }

    body.printing-labels * {
      visibility: hidden !important;
    }

    body.printing-labels aside,
    body.printing-labels header,
    body.printing-labels .no-print {
      display: none !important;
    }

    body.printing-labels main {
      padding: 0 !important;
      overflow: visible !important;
    }

    body.printing-labels .print-only,
    body.printing-labels .print-only * {
      visibility: visible !important;
    }

    body.printing-labels .print-only {
      display: block !important;
      position: absolute;
      left: 0;
      top: 0;
      width: 100%;
      background: white;
    }

    body.printing-labels .label-grid {
      display: grid !important;
      grid-template-columns: 1fr 1fr;
      grid-auto-rows: 69mm;
      gap: 0;
      align-items: stretch;
    }

    body.printing-labels .label-item {
      height: 69mm;
      border: 1px dashed #9ca3af;
      box-sizing: border-box;
      padding: 7mm 8mm;
      page-break-inside: avoid;
      break-inside: avoid;
      overflow: hidden;
      display: flex !important;
      flex-direction: column;
      justify-content: center;
    }

    body.printing-labels .label-item:nth-child(8n) {
      page-break-after: always;
      break-after: page;
    }

    body.printing-labels .label-item:last-child {
      page-break-after: auto;
      break-after: auto;
    }
  }

  @media screen {
    .print-only {
      display: none;
    }
  }
`;

function splitMatieres(value: string | null): string[] {
  if (!value) return ["-"];
  const parts = value
    .split(/[,;/|]+/)
    .map((part) => part.trim())
    .filter(Boolean);
  return parts.length > 0 ? parts : ["-"];
}

function csvCell(value: string | null | undefined): string {
  return `"${(value ?? "").replaceAll('"', '""')}"`;
}

export default function CodesProfsPage() {
  const navigate = useNavigate();
  const [data, setData] = useState<CodesProfsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [filterMatiere, setFilterMatiere] = useState("all");

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await apiFetch<CodesProfsResponse>("admin/codes-profs");
        setData(res);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erreur de chargement");
      }
      setLoading(false);
    })();
  }, []);

  const filtered = useMemo(() => {
    if (!data) return [];
    const normalizedSearch = search.toLowerCase().trim();

    return data.profs.filter((prof) => {
      if (!prof.codeAcces) return false;
      if (
        filterMatiere !== "all" &&
        !splitMatieres(prof.matieres).includes(filterMatiere)
      ) {
        return false;
      }
      if (
        normalizedSearch &&
        !`${prof.nom} ${prof.prenom} ${prof.codeAcces} ${prof.matieres ?? ""}`
          .toLowerCase()
          .includes(normalizedSearch)
      ) {
        return false;
      }
      return true;
    });
  }, [data, filterMatiere, search]);

  const pageCount = filtered.length === 0 ? 0 : Math.ceil(filtered.length / 8);

  function handlePrint() {
    document.body.classList.add("printing-labels");
    const cleanup = () => document.body.classList.remove("printing-labels");
    window.addEventListener("afterprint", cleanup, { once: true });
    setTimeout(() => {
      window.print();
      setTimeout(cleanup, 500);
    }, 100);
  }

  function downloadCSV() {
    const csv = [
      ["Nom", "Prenom", "Matieres", "Email", "Code d'acces"].join(";"),
      ...filtered.map((prof) =>
        [
          csvCell(prof.nom),
          csvCell(prof.prenom),
          csvCell(prof.matieres),
          csvCell(prof.email),
          csvCell(prof.codeAcces),
        ].join(";")
      ),
    ].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `codes-profs-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <style>{PRINT_STYLES}</style>

      <div className="no-print space-y-6">
        <button
          onClick={() => navigate("/admin")}
          className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700"
        >
          <ArrowLeft className="w-4 h-4" />
          Retour
        </button>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold font-heading text-gray-900">
              Codes professeurs
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              {data
                ? `${filtered.length} etiquettes selectionnees - ${pageCount} page(s) A4`
                : "Chargement..."}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={downloadCSV}
              disabled={!filtered.length}
              className="inline-flex items-center gap-2 rounded-xl bg-white border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-all disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              CSV
            </button>
            <button
              onClick={handlePrint}
              disabled={!filtered.length}
              className="inline-flex items-center gap-2 rounded-xl bg-primary-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-600 transition-all disabled:opacity-50"
            >
              <Printer className="w-4 h-4" />
              Imprimer ({filtered.length})
            </button>
          </div>
        </div>

        {error && (
          <div className="rounded-xl bg-red-50 border border-red-200 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        <Card>
          <CardHeader className="space-y-4">
            <div className="rounded-xl bg-blue-50 border border-blue-100 px-4 py-3 text-sm text-blue-900">
              Format pret pour A4 portrait : 8 etiquettes par page, 2 colonnes
              x 4 lignes. Le filtre matiere aide a imprimer par lots.
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Rechercher un professeur, une matiere ou un code..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2.5 pl-10 pr-4 text-sm outline-none focus:border-primary-500"
                />
              </div>
              <div className="relative">
                <select
                  value={filterMatiere}
                  onChange={(e) => setFilterMatiere(e.target.value)}
                  className="appearance-none rounded-xl border border-gray-200 bg-gray-50 py-2.5 pl-4 pr-10 text-sm outline-none focus:border-primary-500 min-w-[200px]"
                >
                  <option value="all">Toutes matieres</option>
                  {data?.parMatiere
                    .filter((matiere) => matiere.nom !== "-")
                    .map((matiere) => (
                      <option key={matiere.nom} value={matiere.nom}>
                        {matiere.nom} ({matiere.nb})
                      </option>
                    ))}
                </select>
                <Filter className="absolute right-8 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary-500 border-t-transparent" />
              </div>
            ) : filtered.length === 0 ? (
              <p className="text-center text-sm text-gray-400 py-16">
                Aucun professeur ne correspond a ce filtre.
              </p>
            ) : (
              <div className="overflow-x-auto max-h-[520px]">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-white border-b">
                    <tr className="text-left text-xs font-medium text-gray-500 uppercase">
                      <th className="px-4 py-3">Professeur</th>
                      <th className="px-4 py-3">Matieres</th>
                      <th className="px-4 py-3">Code</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {filtered.map((prof) => (
                      <tr key={prof.id}>
                        <td className="px-4 py-2.5 font-medium text-gray-900">
                          {prof.nom} {prof.prenom}
                        </td>
                        <td className="px-4 py-2.5 text-gray-600">
                          {prof.matieres ?? "-"}
                        </td>
                        <td className="px-4 py-2.5">
                          <code className="rounded bg-gray-100 px-2 py-1 text-xs font-mono text-primary-600">
                            {prof.codeAcces}
                          </code>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="print-only">
        <div className="label-grid">
          {filtered.map((prof) => (
            <div key={prof.id} className="label-item">
              <p style={{ fontSize: "10pt", color: "#666", marginBottom: 4 }}>
                Lycee Blaise Cendrars - Sevran
              </p>
              <p
                style={{
                  fontSize: "13pt",
                  fontWeight: "bold",
                  marginBottom: 2,
                }}
              >
                {prof.nom} {prof.prenom}
              </p>
              <p style={{ fontSize: "11pt", color: "#444", marginBottom: 10 }}>
                Matiere(s) : <strong>{prof.matieres ?? "-"}</strong>
              </p>
              <p style={{ fontSize: "10pt", color: "#666", marginBottom: 4 }}>
                Code d'acces professeur :
              </p>
              <p
                style={{
                  fontSize: "15pt",
                  fontFamily: "monospace",
                  fontWeight: "bold",
                  color: "#1e40af",
                  letterSpacing: "1px",
                  marginBottom: 10,
                  border: "1px solid #1e40af",
                  padding: "6px 10px",
                  display: "inline-block",
                  borderRadius: 4,
                }}
              >
                {prof.codeAcces}
              </p>
              <p style={{ fontSize: "8.5pt", color: "#666", lineHeight: 1.35 }}>
                gestion.lycee-blaise-cendrars-sevran.fr
                <br />
                Onglet "Je suis professeur" - saisis ton code.
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
