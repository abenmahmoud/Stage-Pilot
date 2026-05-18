import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "../../lib/api";
import { Card, CardContent, CardHeader } from "../../components/ui/Card";
import {
  ArrowLeft,
  Printer,
  Search,
  Filter,
  Download,
  ChevronDown,
} from "lucide-react";

interface EleveCode {
  id: string;
  nom: string;
  prenom: string;
  codeAcces: string | null;
  classeNom: string | null;
  classeNiveau: string | null;
}

interface CodesResponse {
  total: number;
  eleves: EleveCode[];
  parClasse: Array<{ nom: string; nb: number }>;
}

export default function CodesAccesPage() {
  const navigate = useNavigate();
  const [data, setData] = useState<CodesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [filterClasse, setFilterClasse] = useState<string>("all");
  const [filterNiveau, setFilterNiveau] = useState<string>("all");

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await apiFetch<CodesResponse>("admin/codes-acces");
        setData(res);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erreur de chargement");
      }
      setLoading(false);
    })();
  }, []);

  const filtered = useMemo(() => {
    if (!data) return [];
    return data.eleves.filter((e) => {
      if (!e.codeAcces) return false;
      if (filterClasse !== "all" && e.classeNom !== filterClasse) return false;
      if (filterNiveau !== "all" && e.classeNiveau !== filterNiveau)
        return false;
      if (
        search &&
        !`${e.nom} ${e.prenom} ${e.codeAcces}`
          .toLowerCase()
          .includes(search.toLowerCase())
      )
        return false;
      return true;
    });
  }, [data, search, filterClasse, filterNiveau]);

  function handlePrint() {
    // Toggle un mode "print-ready" : on cache tout sauf les étiquettes
    document.body.classList.add("printing-labels");
    setTimeout(() => {
      window.print();
      document.body.classList.remove("printing-labels");
    }, 100);
  }

  function downloadCSV() {
    const csv = [
      ["Nom", "Prénom", "Classe", "Niveau", "Code d'accès"].join(","),
      ...filtered.map((e) =>
        [
          `"${e.nom}"`,
          `"${e.prenom}"`,
          `"${e.classeNom ?? ""}"`,
          `"${e.classeNiveau ?? ""}"`,
          `"${e.codeAcces ?? ""}"`,
        ].join(",")
      ),
    ].join("\n");
    // Ajoute BOM UTF-8 pour Excel
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `codes-acces-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Styles d'impression */}
      <style>{`
        @media print {
          body.printing-labels {
            background: white;
          }
          body.printing-labels .no-print {
            display: none !important;
          }
          body.printing-labels .print-only {
            display: block !important;
          }
          body.printing-labels .label-grid {
            display: grid !important;
            grid-template-columns: 1fr 1fr;
            gap: 0;
            page-break-inside: auto;
          }
          body.printing-labels .label-item {
            border: 1px dashed #999;
            padding: 12mm 8mm;
            page-break-inside: avoid;
            break-inside: avoid;
            min-height: 67mm; /* 8 étiquettes par A4 : 297mm / 4 = 74mm */
            display: flex !important;
            flex-direction: column;
            justify-content: center;
          }
          @page {
            size: A4 portrait;
            margin: 8mm;
          }
        }
        .print-only { display: none; }
      `}</style>

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
              Codes d'accès élèves
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              {data
                ? `${data.total} élèves au total — sélectionne une classe puis imprime les étiquettes (2 par ligne, 4 lignes par page A4)`
                : "Chargement…"}
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
          <CardHeader className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Rechercher un élève ou un code…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2.5 pl-10 pr-4 text-sm outline-none focus:border-primary-500"
              />
            </div>
            <div className="relative">
              <select
                value={filterNiveau}
                onChange={(e) => setFilterNiveau(e.target.value)}
                className="appearance-none rounded-xl border border-gray-200 bg-gray-50 py-2.5 pl-4 pr-10 text-sm outline-none focus:border-primary-500"
              >
                <option value="all">Tous niveaux</option>
                <option value="seconde">Seconde</option>
                <option value="premiere">Première</option>
                <option value="terminale">Terminale</option>
                <option value="autre">Autre</option>
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>
            <div className="relative">
              <select
                value={filterClasse}
                onChange={(e) => setFilterClasse(e.target.value)}
                className="appearance-none rounded-xl border border-gray-200 bg-gray-50 py-2.5 pl-4 pr-10 text-sm outline-none focus:border-primary-500 min-w-[140px]"
              >
                <option value="all">Toutes classes</option>
                {data?.parClasse.map((c) => (
                  <option key={c.nom} value={c.nom}>
                    {c.nom} ({c.nb})
                  </option>
                ))}
              </select>
              <Filter className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary-500 border-t-transparent" />
              </div>
            ) : filtered.length === 0 ? (
              <p className="text-center text-sm text-gray-400 py-16">
                Aucun élève ne correspond à ce filtre.
              </p>
            ) : (
              <div className="overflow-x-auto max-h-[500px]">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-white border-b">
                    <tr className="text-left text-xs font-medium text-gray-500 uppercase">
                      <th className="px-4 py-3">Élève</th>
                      <th className="px-4 py-3">Classe</th>
                      <th className="px-4 py-3">Code d'accès</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {filtered.slice(0, 100).map((e) => (
                      <tr key={e.id}>
                        <td className="px-4 py-2.5 font-medium text-gray-900">
                          {e.nom} {e.prenom}
                        </td>
                        <td className="px-4 py-2.5 text-gray-600">
                          {e.classeNom ?? "—"}
                        </td>
                        <td className="px-4 py-2.5">
                          <code className="rounded bg-gray-100 px-2 py-1 text-xs font-mono text-primary-600">
                            {e.codeAcces}
                          </code>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {filtered.length > 100 && (
                  <p className="text-xs text-gray-400 text-center py-2">
                    100 premiers affichés sur {filtered.length}.
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Zone d'impression — visible uniquement à l'impression */}
      <div className="print-only">
        <div className="label-grid">
          {filtered.map((e) => (
            <div key={e.id} className="label-item">
              <p style={{ fontSize: "10pt", color: "#666", marginBottom: 4 }}>
                Lycée Blaise Cendrars — Sevran
              </p>
              <p
                style={{
                  fontSize: "13pt",
                  fontWeight: "bold",
                  marginBottom: 2,
                }}
              >
                {e.nom} {e.prenom}
              </p>
              <p style={{ fontSize: "11pt", color: "#444", marginBottom: 12 }}>
                Classe : <strong>{e.classeNom}</strong>
              </p>
              <p style={{ fontSize: "10pt", color: "#666", marginBottom: 4 }}>
                Ton code d'accès personnel :
              </p>
              <p
                style={{
                  fontSize: "14pt",
                  fontFamily: "monospace",
                  fontWeight: "bold",
                  color: "#1e40af",
                  letterSpacing: "1px",
                  marginBottom: 12,
                  border: "1px solid #1e40af",
                  padding: "6px 10px",
                  display: "inline-block",
                  borderRadius: 4,
                }}
              >
                {e.codeAcces}
              </p>
              <p style={{ fontSize: "9pt", color: "#666", lineHeight: 1.4 }}>
                Connecte-toi sur :<br />
                <strong>gestion.lycee-blaise-cendrars-sevran.fr</strong>
                <br />
                Onglet "Je suis élève" → saisis ton code.
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
