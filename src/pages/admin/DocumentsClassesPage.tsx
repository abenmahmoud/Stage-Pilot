import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Briefcase,
  ChevronDown,
  ExternalLink,
  FileText,
  FolderOpen,
  Mic2,
  Search,
} from "lucide-react";
import { apiFetch } from "../../lib/api";
import { Card, CardContent, CardHeader } from "../../components/ui/Card";

type DocumentType = "stage" | "grand_oral";
type DocumentTypeFilter = "all" | DocumentType;

interface PdfDocument {
  id: string;
  type: DocumentType;
  eleveId: string;
  eleveNom: string;
  elevePrenom: string;
  classeId: string | null;
  classeNom: string | null;
  statut: string;
  pdfUrl: string;
  generatedAt: string | null;
}

interface ClasseDocuments {
  id: string;
  nom: string;
  niveau: string;
  totalEleves: number;
  stageFinalises: number;
  goFinalises: number;
  documents: PdfDocument[];
}

interface DocumentsClassesResponse {
  totalClasses: number;
  totalDocuments: number;
  classes: ClasseDocuments[];
}

const TYPE_LABELS: Record<DocumentType, string> = {
  stage: "Stage",
  grand_oral: "Grand Oral",
};

function formatDate(value: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("fr-FR").format(date);
}

function documentMatches(doc: PdfDocument, search: string): boolean {
  if (!search) return true;
  return `${doc.eleveNom} ${doc.elevePrenom} ${doc.classeNom ?? ""} ${
    doc.statut
  } ${TYPE_LABELS[doc.type]}`
    .toLowerCase()
    .includes(search);
}

export default function DocumentsClassesPage() {
  const navigate = useNavigate();
  const [data, setData] = useState<DocumentsClassesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [selectedClasse, setSelectedClasse] = useState("all");
  const [typeFilter, setTypeFilter] = useState<DocumentTypeFilter>("all");

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await apiFetch<DocumentsClassesResponse>(
          "admin/documents-classes"
        );
        setData(res);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erreur de chargement");
      }
      setLoading(false);
    })();
  }, []);

  const visibleClasses = useMemo(() => {
    if (!data) return [];
    const normalizedSearch = search.toLowerCase().trim();

    return data.classes
      .filter(
        (classe) => selectedClasse === "all" || classe.id === selectedClasse
      )
      .map((classe) => {
        const classMatches =
          Boolean(normalizedSearch) &&
          `${classe.nom} ${classe.niveau}`.toLowerCase().includes(normalizedSearch);
        const documents = classe.documents.filter((doc) => {
          if (typeFilter !== "all" && doc.type !== typeFilter) return false;
          return classMatches || documentMatches(doc, normalizedSearch);
        });

        return {
          ...classe,
          documents,
          classMatches,
        };
      })
      .filter((classe) => {
        if (!normalizedSearch) return true;
        return classe.classMatches || classe.documents.length > 0;
      });
  }, [data, search, selectedClasse, typeFilter]);

  const visibleDocumentCount = visibleClasses.reduce(
    (sum, classe) => sum + classe.documents.length,
    0
  );

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <button
        onClick={() => navigate("/admin")}
        className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700"
      >
        <ArrowLeft className="w-4 h-4" />
        Retour
      </button>

      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-heading text-gray-900">
            Documents PDF par classe
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Toutes les classes restent visibles, avec les PDF finalises faciles
            a retrouver.
          </p>
        </div>
        <div className="grid grid-cols-3 gap-2 sm:min-w-[420px]">
          <div className="rounded-xl border border-gray-200 bg-white px-4 py-3">
            <p className="text-xs text-gray-500">Classes</p>
            <p className="text-lg font-bold text-gray-900">
              {data?.totalClasses ?? 0}
            </p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white px-4 py-3">
            <p className="text-xs text-gray-500">PDF visibles</p>
            <p className="text-lg font-bold text-gray-900">
              {visibleDocumentCount}
            </p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white px-4 py-3">
            <p className="text-xs text-gray-500">PDF total</p>
            <p className="text-lg font-bold text-gray-900">
              {data?.totalDocuments ?? 0}
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      <Card>
        <CardHeader className="flex flex-col lg:flex-row lg:items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Rechercher une classe, un eleve, un statut..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2.5 pl-10 pr-4 text-sm outline-none focus:border-primary-500"
            />
          </div>
          <div className="relative">
            <select
              value={selectedClasse}
              onChange={(e) => setSelectedClasse(e.target.value)}
              className="appearance-none rounded-xl border border-gray-200 bg-gray-50 py-2.5 pl-4 pr-10 text-sm outline-none focus:border-primary-500 min-w-[180px]"
            >
              <option value="all">Toutes classes</option>
              {data?.classes.map((classe) => (
                <option key={classe.id} value={classe.id}>
                  {classe.nom}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          </div>
          <div className="relative">
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as DocumentTypeFilter)}
              className="appearance-none rounded-xl border border-gray-200 bg-gray-50 py-2.5 pl-4 pr-10 text-sm outline-none focus:border-primary-500 min-w-[170px]"
            >
              <option value="all">Tous documents</option>
              <option value="stage">Stages</option>
              <option value="grand_oral">Grand Oral</option>
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          </div>
        </CardHeader>
      </Card>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary-500 border-t-transparent" />
        </div>
      ) : visibleClasses.length === 0 ? (
        <Card>
          <CardContent className="text-center py-16 text-gray-400">
            <FolderOpen className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p className="text-sm">Aucune classe ne correspond a la recherche.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {visibleClasses.map((classe) => (
            <Card key={classe.id}>
              <CardHeader className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary-50 text-primary-600 flex items-center justify-center">
                    <FolderOpen className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-semibold text-gray-900">
                      {classe.nom}
                    </h2>
                    <p className="text-sm text-gray-500">
                      {classe.niveau} - {classe.totalEleves} eleves
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 text-xs">
                  <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-3 py-1 font-medium text-blue-700">
                    <Briefcase className="w-3.5 h-3.5" />
                    {classe.stageFinalises} stage
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-3 py-1 font-medium text-violet-700">
                    <Mic2 className="w-3.5 h-3.5" />
                    {classe.goFinalises} GO
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-3 py-1 font-medium text-gray-600">
                    <FileText className="w-3.5 h-3.5" />
                    {classe.documents.length} visible(s)
                  </span>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {classe.documents.length === 0 ? (
                  <p className="px-6 py-5 text-sm text-gray-400">
                    Aucun PDF finalise trouve avec les filtres actuels.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-100 text-left text-xs font-medium text-gray-500 uppercase">
                          <th className="px-6 py-3">Document</th>
                          <th className="px-6 py-3">Eleve</th>
                          <th className="px-6 py-3">Statut</th>
                          <th className="px-6 py-3">Genere le</th>
                          <th className="px-6 py-3 text-right">PDF</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {classe.documents.map((doc) => (
                          <tr key={`${doc.type}-${doc.id}`}>
                            <td className="px-6 py-3.5">
                              <span
                                className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${
                                  doc.type === "stage"
                                    ? "bg-blue-50 text-blue-700"
                                    : "bg-violet-50 text-violet-700"
                                }`}
                              >
                                {doc.type === "stage" ? (
                                  <Briefcase className="w-3.5 h-3.5" />
                                ) : (
                                  <Mic2 className="w-3.5 h-3.5" />
                                )}
                                {TYPE_LABELS[doc.type]}
                              </span>
                            </td>
                            <td className="px-6 py-3.5 font-medium text-gray-900">
                              {doc.eleveNom} {doc.elevePrenom}
                            </td>
                            <td className="px-6 py-3.5 text-gray-600">
                              {doc.statut}
                            </td>
                            <td className="px-6 py-3.5 text-gray-600">
                              {formatDate(doc.generatedAt)}
                            </td>
                            <td className="px-6 py-3.5 text-right">
                              <a
                                href={doc.pdfUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-2 rounded-xl bg-primary-500 px-3 py-2 text-xs font-semibold text-white hover:bg-primary-600 transition-colors"
                              >
                                Ouvrir
                                <ExternalLink className="w-3.5 h-3.5" />
                              </a>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
